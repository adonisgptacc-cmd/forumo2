import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { brandColors, spacing } from '@forumo/config';
import { useAuth } from '../providers/AuthProvider';

interface KycDocument {
  id: string;
  type: string;
  url: string;
  status: string;
}

interface KycSubmission {
  id: string;
  userId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  documents: KycDocument[];
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  PENDING:  { bg: '#fef9c3', text: '#854d0e', label: 'Under Review' },
  APPROVED: { bg: '#dcfce7', text: '#166534', label: 'Approved ✓' },
  REJECTED: { bg: '#fee2e2', text: '#991b1b', label: 'Rejected' },
};

export const KYCScreen: React.FC = () => {
  const { apiClient } = useAuth();
  const [kyc, setKyc] = useState<KycSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<KycSubmission>('/kyc/status', { auth: true });
      setKyc(data);
    } catch {
      setKyc(null);
    }
  }, [apiClient]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const handleSubmit = async () => {
    Alert.alert(
      'Submit KYC',
      'This will submit your identity for verification. In the full app, you will be able to upload ID documents. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSubmitting(true);
            try {
              const formData = new FormData();
              // In production: append document images here via expo-image-picker
              const data = await apiClient.post<KycSubmission>('/kyc/submit', formData, { auth: true });
              setKyc(data);
              Alert.alert('Submitted', 'Your KYC has been submitted for review. We will notify you once reviewed.');
            } catch (e: any) {
              Alert.alert('Error', e.message ?? 'Could not submit KYC.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={brandColors.primary} />
      </View>
    );
  }

  const statusStyle = kyc ? (STATUS_STYLES[kyc.status] ?? STATUS_STYLES.PENDING) : null;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Identity Verification</Text>
      <Text style={styles.subtitle}>
        Verify your identity to unlock higher trust scores, higher selling limits, and escrow access.
      </Text>

      {/* Current status */}
      {kyc ? (
        <View style={styles.section}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle?.bg }]}>
            <Text style={[styles.statusText, { color: statusStyle?.text }]}>{statusStyle?.label}</Text>
          </View>
          <Text style={styles.fieldLabel}>Submitted</Text>
          <Text style={styles.fieldValue}>{new Date(kyc.submittedAt).toLocaleDateString()}</Text>
          {kyc.reviewedAt && (
            <>
              <Text style={styles.fieldLabel}>Reviewed</Text>
              <Text style={styles.fieldValue}>{new Date(kyc.reviewedAt).toLocaleDateString()}</Text>
            </>
          )}
          {kyc.status === 'REJECTED' && kyc.rejectionReason && (
            <View style={styles.rejectionBox}>
              <Text style={styles.rejectionTitle}>Rejection reason</Text>
              <Text style={styles.rejectionText}>{kyc.rejectionReason}</Text>
            </View>
          )}
          {kyc.documents.length > 0 && (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Documents</Text>
              {kyc.documents.map((doc) => (
                <View key={doc.id} style={styles.docRow}>
                  <Text style={styles.docType}>{doc.type}</Text>
                  <Text style={[styles.docStatus, doc.status === 'APPROVED' ? { color: '#16a34a' } : { color: '#6b7280' }]}>
                    {doc.status}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.noKycText}>You have not submitted KYC yet.</Text>
        </View>
      )}

      {/* What's required */}
      {!kyc && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What you will need</Text>
          {[
            '🪪  Government-issued photo ID (passport, driver's licence, or national ID)',
            '🤳  Selfie holding your ID',
            '📍  Proof of address (utility bill or bank statement, less than 3 months old)',
          ].map((item) => (
            <Text key={item} style={styles.requirementItem}>{item}</Text>
          ))}
        </View>
      )}

      {/* CTA */}
      {(!kyc || kyc.status === 'REJECTED') && (
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              {kyc?.status === 'REJECTED' ? 'Resubmit KYC' : 'Begin Verification'}
            </Text>
          )}
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 22, fontWeight: '800', margin: spacing.md, marginBottom: 6, color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginHorizontal: spacing.md, marginBottom: spacing.md, lineHeight: 20 },
  section: {
    backgroundColor: brandColors.card,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    padding: spacing.md,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12 },
  statusText: { fontSize: 14, fontWeight: '700' },
  fieldLabel: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
  fieldValue: { fontSize: 14, color: '#111827', marginTop: 2 },
  rejectionBox: { backgroundColor: '#fef2f2', borderRadius: 8, padding: 10, marginTop: 10 },
  rejectionTitle: { fontSize: 12, fontWeight: '700', color: '#dc2626', marginBottom: 4 },
  rejectionText: { fontSize: 13, color: '#7f1d1d' },
  docRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  docType: { fontSize: 14, color: '#374151' },
  docStatus: { fontSize: 13, fontWeight: '600' },
  noKycText: { fontSize: 14, color: '#6b7280' },
  requirementItem: { fontSize: 14, color: '#374151', paddingVertical: 6, lineHeight: 20 },
  submitBtn: {
    marginHorizontal: spacing.md,
    backgroundColor: brandColors.primary,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
