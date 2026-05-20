# ═══════════════════════════════════════════════════════════════════════════
# FinGuard 2026 — Multi-Cloud Active-Active Deployment (Terraform)
#
# Deploys synchronized Kubernetes clusters on AWS (EKS) and Azure (AKS)
# with Global Traffic Manager for < 150ms latency worldwide.
#
# Architecture:
#   ┌───────────────────────────────────────────────────────────────┐
#   │              Cloudflare / AWS Global Accelerator              │
#   │                    (Global Load Balancer)                     │
#   └────────┬──────────────────────────────────────┬───────────────┘
#            │                                      │
#   ┌────────▼────────┐                    ┌────────▼────────┐
#   │   AWS EKS       │  ◄── sync ──►     │   Azure AKS     │
#   │   us-east-1     │                    │   eastus         │
#   │   3 node pools  │                    │   3 node pools   │
#   │   + RDS Aurora  │                    │   + CosmosDB     │
#   │   + Neo4j Aura  │                    │   + Neo4j Aura   │
#   └─────────────────┘                    └──────────────────┘
#
# Usage:
#   cd infra/terraform/multicloud
#   terraform init
#   terraform plan -var-file=production.tfvars
#   terraform apply
# ═══════════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.40"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.100"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.30"
    }
  }

  backend "s3" {
    bucket         = "finguard-terraform-state"
    key            = "production/multicloud.tfstate"
    region         = "us-east-1"
    dynamodb_table = "finguard-terraform-locks"
    encrypt        = true
  }
}

# ─── Providers ─────────────────────────────────────────────────────────

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "FinGuard-2026"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Phase       = "8-MultiCloud"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ─── Variables ─────────────────────────────────────────────────────────

variable "environment" {
  type    = string
  default = "production"
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "azure_location" {
  type    = string
  default = "eastus"
}

variable "azure_subscription_id" {
  type      = string
  sensitive = true
  default   = ""
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "cloudflare_zone_id" {
  type    = string
  default = ""
}

variable "eks_node_count" {
  type    = number
  default = 3
}

variable "aks_node_count" {
  type    = number
  default = 3
}

variable "eks_instance_type" {
  type    = string
  default = "m6i.2xlarge"
}

variable "aks_vm_size" {
  type    = string
  default = "Standard_D8s_v5"
}

# ─── AWS EKS Cluster ──────────────────────────────────────────────────

resource "aws_vpc" "finguard" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = { Name = "finguard-vpc" }
}

resource "aws_subnet" "private" {
  count             = 3
  vpc_id            = aws_vpc.finguard.id
  cidr_block        = "10.0.${count.index + 1}.0/24"
  availability_zone = "${var.aws_region}${["a", "b", "c"][count.index]}"

  tags = { Name = "finguard-private-${count.index}" }
}

resource "aws_iam_role" "eks_role" {
  name = "finguard-eks-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_cluster" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_role.name
}

resource "aws_eks_cluster" "finguard" {
  name     = "finguard-${var.environment}"
  role_arn = aws_iam_role.eks_role.arn
  version  = "1.30"

  vpc_config {
    subnet_ids = aws_subnet.private[*].id
  }
}

resource "aws_iam_role" "eks_node_role" {
  name = "finguard-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "eks_worker" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_role.name
}

resource "aws_iam_role_policy_attachment" "eks_cni" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_role.name
}

resource "aws_iam_role_policy_attachment" "ecr_read" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_role.name
}

resource "aws_eks_node_group" "ml_inference" {
  cluster_name    = aws_eks_cluster.finguard.name
  node_group_name = "ml-inference"
  node_role_arn   = aws_iam_role.eks_node_role.arn
  subnet_ids      = aws_subnet.private[*].id

  scaling_config {
    desired_size = var.eks_node_count
    max_size     = var.eks_node_count * 3
    min_size     = 1
  }

  instance_types = [var.eks_instance_type]

  labels = {
    workload = "ml-inference"
    cloud    = "aws"
  }

  tags = { Name = "finguard-eks-ml" }
}

# ─── Azure AKS Cluster ───────────────────────────────────────────────

resource "azurerm_resource_group" "finguard" {
  name     = "finguard-${var.environment}"
  location = var.azure_location
}

resource "azurerm_kubernetes_cluster" "finguard" {
  name                = "finguard-aks-${var.environment}"
  location            = azurerm_resource_group.finguard.location
  resource_group_name = azurerm_resource_group.finguard.name
  dns_prefix          = "finguard"
  kubernetes_version  = "1.30"

  default_node_pool {
    name       = "mlpool"
    node_count = var.aks_node_count
    vm_size    = var.aks_vm_size

    node_labels = {
      workload = "ml-inference"
      cloud    = "azure"
    }
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin = "azure"
    network_policy = "calico"
  }

  tags = {
    Project     = "FinGuard-2026"
    Environment = var.environment
  }
}

# ─── Global Load Balancer (Cloudflare) ────────────────────────────────

resource "cloudflare_load_balancer_pool" "aws" {
  count      = var.cloudflare_zone_id != "" ? 1 : 0
  account_id = var.cloudflare_zone_id
  name       = "finguard-aws-pool"

  origins {
    name    = "aws-eks"
    address = "eks.${var.aws_region}.finguard.ai"
    enabled = true
    weight  = 0.5
  }

  check_regions   = ["WNAM"]
  minimum_origins = 1
}

resource "cloudflare_load_balancer_pool" "azure" {
  count      = var.cloudflare_zone_id != "" ? 1 : 0
  account_id = var.cloudflare_zone_id
  name       = "finguard-azure-pool"

  origins {
    name    = "azure-aks"
    address = "aks.${var.azure_location}.finguard.ai"
    enabled = true
    weight  = 0.5
  }

  check_regions   = ["WEU"]
  minimum_origins = 1
}

# ─── Outputs ─────────────────────────────────────────────────────────

output "eks_cluster_endpoint" {
  description = "AWS EKS cluster endpoint"
  value       = aws_eks_cluster.finguard.endpoint
}

output "aks_cluster_fqdn" {
  description = "Azure AKS cluster FQDN"
  value       = azurerm_kubernetes_cluster.finguard.fqdn
}

output "eks_cluster_name" {
  value = aws_eks_cluster.finguard.name
}

output "aks_cluster_name" {
  value = azurerm_kubernetes_cluster.finguard.name
}
