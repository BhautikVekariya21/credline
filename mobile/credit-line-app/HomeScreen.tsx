import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions
} from 'react-native';

const { width } = Dimensions.get('window');

// Simple vector-equivalent custom SVG icons to avoid Expo/React Native SVG package crashes
const ShieldIcon = () => (
  <View style={styles.iconCircle}>
    <Text style={{ color: '#00E676', fontWeight: 'bold', fontSize: 14 }}>🛡️</Text>
  </View>
);

const WalletIcon = () => (
  <View style={styles.iconCircle}>
    <Text style={{ color: '#AF52DE', fontWeight: 'bold', fontSize: 14 }}>💼</Text>
  </View>
);

const SparkIcon = () => (
  <View style={{ marginRight: 6 }}>
    <Text style={{ fontSize: 12 }}>⚡</Text>
  </View>
);

export default function HomeScreen() {
  // Mock customer state
  const [creditLimit, setCreditLimit] = useState(50000);
  const [usedLimit, setUsedLimit] = useState(12000);
  const [alternativeCreditScore, setAlternativeCreditScore] = useState(785);
  
  // ZK Prover State
  const [zkStatus, setZkStatus] = useState<'IDLE' | 'COMPUTING_WITNESS' | 'GENERATING_PROOF' | 'VERIFIED' | 'FAILED'>('IDLE');
  const [zkProofConsole, setZkProofConsole] = useState<string[]>([]);
  const [verifiedHash, setVerifiedHash] = useState<string | null>(null);

  const availableLimit = creditLimit - usedLimit;
  const utilizedPercent = (usedLimit / creditLimit) * 100;

  const handleGenerateZKProof = async () => {
    setZkStatus('COMPUTING_WITNESS');
    setZkProofConsole(['[SYSTEM] Initializing solvency proof generation...']);
    
    await new Promise(r => setTimeout(r, 600));
    setZkProofConsole(prev => [
      ...prev,
      '[PROVER] Loading Merkle membership path...',
      '[PROVER] Computing constraint witnesses: Sum(Assets) > Sum(Liabilities)...'
    ]);
    setZkStatus('GENERATING_PROOF');

    await new Promise(r => setTimeout(r, 850));
    const mockCommitment = '0x' + Math.floor(Math.random() * 100000000).toString(16) + '...deadbeef';
    setZkProofConsole(prev => [
      ...prev,
      `[PROVER] Generated ZK-SNARK commitment: ${mockCommitment}`,
      '[PROVER] Elliptic BN256 pairings checks passed.',
      '[SYSTEM] Delivering ZK witness verification payload to Credit Line node...'
    ]);

    await new Promise(r => setTimeout(r, 700));
    // Simulate endpoint check
    const mockTxHash = '0x' + Math.floor(Math.random() * 10000000000).toString(16) + 'f0c8b8';
    setZkStatus('VERIFIED');
    setVerifiedHash(mockTxHash);
    setZkProofConsole(prev => [
      ...prev,
      '[VERIFIER] Solvency Proof Status: VALIDATED',
      `[LEDGER] Registered zero-knowledge commitment transaction: ${mockTxHash}`
    ]);
    
    // Grant limit extension on successful solvency proof verification
    setCreditLimit(prev => prev + 15000);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      
      {/* Brand Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Credit Line</Text>
          <Text style={styles.headerSubtitle}>Consumer Super-App</Text>
        </View>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>Alt Score</Text>
          <Text style={styles.scoreValue}>{alternativeCreditScore}</Text>
        </View>
      </View>

      {/* Credit Limit Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Available Credit Line</Text>
          <Text style={styles.cardAmount}>INR {availableLimit.toLocaleString('en-IN')}</Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${utilizedPercent}%` }]} />
          </View>
          <View style={styles.limitDetails}>
            <Text style={styles.limitText}>Used: INR {usedLimit.toLocaleString('en-IN')}</Text>
            <Text style={styles.limitText}>Limit: INR {creditLimit.toLocaleString('en-IN')}</Text>
          </View>
        </View>
      </View>

      {/* Repayments Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Repayment Schedule</Text>
        <View style={styles.repaymentRow}>
          <View>
            <Text style={styles.repaymentDue}>Next Payment Due</Text>
            <Text style={styles.repaymentDate}>June 10, 2026</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.repaymentAmount}>INR 4,285.00</Text>
            <TouchableOpacity style={styles.payButton}>
              <Text style={styles.payButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ZK Solvency Wallet Prover */}
      <View style={styles.card}>
        <View style={styles.zkHeader}>
          <ShieldIcon />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.sectionTitle}>Zero-Knowledge Identity Wallet</Text>
            <Text style={styles.zkDescription}>Prove solvency and income to extend limits without sharing raw statements.</Text>
          </View>
        </View>

        {zkStatus === 'IDLE' && (
          <TouchableOpacity style={styles.zkButton} onPress={handleGenerateZKProof}>
            <Text style={styles.zkButtonText}>Generate ZK Solvency Proof</Text>
          </TouchableOpacity>
        )}

        {(zkStatus === 'COMPUTING_WITNESS' || zkStatus === 'GENERATING_PROOF') && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#00E676" />
            <Text style={styles.loadingText}>
              {zkStatus === 'COMPUTING_WITNESS' ? 'Computing witnesses...' : 'Generating SNARK proof...'}
            </Text>
          </View>
        )}

        {zkStatus === 'VERIFIED' && (
          <View style={styles.verifiedContainer}>
            <Text style={styles.verifiedText}>✓ Identity & Solvency Verified</Text>
            <Text style={styles.verifiedSubText}>Credit Limit extended by INR 15,000!</Text>
          </View>
        )}

        {/* ZK Proof Console logs */}
        {zkProofConsole.length > 0 && (
          <View style={styles.consoleContainer}>
            {zkProofConsole.map((log, index) => (
              <Text key={index} style={styles.consoleText}>
                {log}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Active Syndicates Hub */}
      <View style={styles.card}>
        <View style={styles.zkHeader}>
          <WalletIcon />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.sectionTitle}>USDC Syndicate Pool</Text>
            <Text style={styles.zkDescription}>Funding syndicated dynamically from Web3 pools.</Text>
          </View>
        </View>
        <View style={styles.syndicateMetrics}>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>TVL</Text>
            <Text style={styles.metricValue}>$4,820,000</Text>
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Expected Loss</Text>
            <Text style={styles.metricValue}>0.85%</Text>
          </View>
          <View style={styles.metricCol}>
            <Text style={styles.metricLabel}>Active Yield</Text>
            <Text style={styles.metricValue}>12.4% APR</Text>
          </View>
        </View>
      </View>
      
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C', // Core Obsidian
  },
  contentContainer: {
    padding: 20,
    paddingTop: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  scoreContainer: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00E676', // Yield Green
    marginTop: 2,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  cardHeader: {
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  progressContainer: {
    marginTop: 5,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#2C2C2E',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00E676', // Yield Green
  },
  limitDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  limitText: {
    fontSize: 10,
    color: '#8E8E93',
    fontFamily: 'System',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  repaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15,
  },
  repaymentDue: {
    fontSize: 10,
    color: '#8E8E93',
  },
  repaymentDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 3,
  },
  repaymentAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  payButton: {
    backgroundColor: '#00E676',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 6,
  },
  payButtonText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  zkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  zkDescription: {
    fontSize: 10,
    color: '#8E8E93',
    lineHeight: 14,
    marginTop: 2,
  },
  zkButton: {
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  zkButtonText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: 'bold',
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
    color: '#00E676',
    fontFamily: 'System',
  },
  verifiedContainer: {
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  verifiedText: {
    color: '#00E676',
    fontSize: 12,
    fontWeight: 'bold',
  },
  verifiedSubText: {
    color: '#8E8E93',
    fontSize: 10,
    marginTop: 2,
  },
  consoleContainer: {
    backgroundColor: '#000000',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  consoleText: {
    color: '#AF52DE',
    fontFamily: 'System', // Fallback to System since fonts can differ on mobile
    fontSize: 9,
    lineHeight: 13,
    marginBottom: 2,
  },
  syndicateMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    borderTopWidth: 1,
    borderColor: '#2C2C2E',
    paddingTop: 12,
  },
  metricCol: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  }
});
