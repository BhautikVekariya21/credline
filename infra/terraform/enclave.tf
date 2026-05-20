# ═══════════════════════════════════════════════════════════════════════════
# FinGuard 2026 — AWS Nitro Enclave Deployment (Terraform)
#
# Deploys ML model inference inside AWS Nitro Enclaves for confidential
# computing. Model weights and PII decryption keys exist ONLY inside
# the secure enclave — not even the host EC2 instance can access them.
#
# Usage:
#   cd infra/terraform
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
  }

  backend "s3" {
    bucket         = "finguard-terraform-state"
    key            = "production/enclave.tfstate"
    region         = "us-east-1"
    dynamodb_table = "finguard-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "FinGuard-2026"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Phase       = "4-EdgeSecurity"
    }
  }
}

# ─── Variables ──────────────────────────────────────────────────────────

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "enclave_instance_type" {
  description = "EC2 instance type with Nitro Enclave support"
  type        = string
  default     = "c5.2xlarge"  # 8 vCPU, 16 GB — Nitro-compatible
}

variable "enclave_cpu_count" {
  description = "vCPUs allocated to the enclave"
  type        = number
  default     = 4
}

variable "enclave_memory_mb" {
  description = "Memory allocated to the enclave (MB)"
  type        = number
  default     = 8192
}

variable "vpc_id" {
  description = "VPC ID for deployment"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for enclave instances"
  type        = list(string)
}

# ─── KMS Key for Enclave Attestation ───────────────────────────────────

resource "aws_kms_key" "enclave_key" {
  description             = "FinGuard Enclave attestation key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEnclaveDecrypt"
        Effect = "Allow"
        Principal = { AWS = aws_iam_role.enclave_role.arn }
        Action    = ["kms:Decrypt"]
        Resource  = "*"
        Condition = {
          StringEqualsIgnoreCase = {
            "kms:RecipientAttestation:PCR0" = var.enclave_pcr0_hash
          }
        }
      },
      {
        Sid    = "AllowAdminManagement"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      }
    ]
  })
}

variable "enclave_pcr0_hash" {
  description = "PCR0 hash of the enclave image for attestation"
  type        = string
  default     = "PLACEHOLDER_REPLACE_AFTER_BUILD"
}

resource "aws_kms_alias" "enclave_alias" {
  name          = "alias/finguard-enclave-key"
  target_key_id = aws_kms_key.enclave_key.key_id
}

# ─── IAM Role for Enclave Host ─────────────────────────────────────────

data "aws_caller_identity" "current" {}

resource "aws_iam_role" "enclave_role" {
  name = "finguard-enclave-host-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "enclave_policy" {
  name = "finguard-enclave-policy"
  role = aws_iam_role.enclave_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
        ]
        Resource = [aws_kms_key.enclave_key.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket",
        ]
        Resource = [
          "arn:aws:s3:::finguard-model-artifacts",
          "arn:aws:s3:::finguard-model-artifacts/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_instance_profile" "enclave_profile" {
  name = "finguard-enclave-profile"
  role = aws_iam_role.enclave_role.name
}

# ─── Security Group ──────────────────────────────────────────────────────

resource "aws_security_group" "enclave_sg" {
  name_prefix = "finguard-enclave-"
  vpc_id      = var.vpc_id
  description = "Security group for FinGuard Nitro Enclave instances"

  ingress {
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    description = "API Gateway"
    cidr_blocks = ["10.0.0.0/8"]
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    description = "SSH (bastion only)"
    cidr_blocks = ["10.0.0.0/8"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ─── Launch Template with Nitro Enclave Enabled ────────────────────────

resource "aws_launch_template" "enclave_lt" {
  name_prefix   = "finguard-enclave-"
  instance_type = var.enclave_instance_type
  image_id      = data.aws_ami.amazon_linux.id

  iam_instance_profile {
    name = aws_iam_instance_profile.enclave_profile.name
  }

  vpc_security_group_ids = [aws_security_group.enclave_sg.id]

  # CRITICAL: Enable Nitro Enclaves
  enclave_options {
    enabled = true
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    set -e

    # Install Nitro CLI
    amazon-linux-extras install aws-nitro-enclaves-cli -y
    yum install aws-nitro-enclaves-cli-devel -y

    # Configure enclave allocator
    cat > /etc/nitro_enclaves/allocator.yaml <<ALLOC
    ---
    memory_mib: ${var.enclave_memory_mb}
    cpu_count: ${var.enclave_cpu_count}
    ALLOC

    # Start enclave allocator service
    systemctl enable nitro-enclaves-allocator
    systemctl start nitro-enclaves-allocator

    # Pull and run the FinGuard enclave image
    aws s3 cp s3://finguard-model-artifacts/enclave/finguard-enclave.eif /opt/finguard/
    nitro-cli run-enclave \
      --eif-path /opt/finguard/finguard-enclave.eif \
      --cpu-count ${var.enclave_cpu_count} \
      --memory ${var.enclave_memory_mb}

    echo "✅ FinGuard Nitro Enclave started"
  EOF
  )

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "finguard-enclave-${var.environment}"
      Role = "ml-inference-enclave"
    }
  }
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}

# ─── Auto Scaling Group ───────────────────────────────────────────────

resource "aws_autoscaling_group" "enclave_asg" {
  name                = "finguard-enclave-asg"
  desired_capacity    = 2
  min_size            = 1
  max_size            = 6
  vpc_zone_identifier = var.private_subnet_ids

  launch_template {
    id      = aws_launch_template.enclave_lt.id
    version = "$Latest"
  }

  health_check_type         = "ELB"
  health_check_grace_period = 300

  tag {
    key                 = "Name"
    value               = "finguard-enclave"
    propagate_at_launch = true
  }
}

# ─── Outputs ─────────────────────────────────────────────────────────

output "kms_key_arn" {
  description = "KMS key ARN for enclave attestation"
  value       = aws_kms_key.enclave_key.arn
}

output "enclave_sg_id" {
  description = "Security group ID for enclave instances"
  value       = aws_security_group.enclave_sg.id
}

output "asg_name" {
  description = "Auto Scaling Group name"
  value       = aws_autoscaling_group.enclave_asg.name
}
