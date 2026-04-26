'use client';

import { useState, useRef, useEffect } from 'react';
import { useKycStatus, useSubmitKyc } from '../../../../lib/react-query/hooks';

// ─── Types ───────────────────────────────────────────────────────────────────

type DocType = 'national_id' | 'passport' | 'drivers_license';
type KycStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

interface WizardState {
  docType: DocType | null;
  frontImage: File | null;
  backImage: File | null;
  selfieImage: File | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES: Array<{
  value: DocType;
  label: string;
  requiresBack: boolean;
  frontLabel: string;
  backLabel: string;
  requirements: string[];
}> = [
  {
    value: 'national_id',
    label: 'National ID',
    requiresBack: true,
    frontLabel: 'Front of National ID',
    backLabel: 'Back of National ID',
    requirements: ['Front side', 'Back side', 'Selfie holding your ID'],
  },
  {
    value: 'passport',
    label: 'Passport',
    requiresBack: false,
    frontLabel: 'Photo / bio-data page',
    backLabel: '',
    requirements: ['Photo page', 'Selfie holding your passport'],
  },
  {
    value: 'drivers_license',
    label: "Driver's Licence",
    requiresBack: true,
    frontLabel: 'Front of Licence',
    backLabel: 'Back of Licence',
    requirements: ['Front side', 'Back side', 'Selfie holding your licence'],
  },
];

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return 'Only JPG, PNG, or PDF files are allowed';
  if (file.size > MAX_SIZE) return 'File must be under 5 MB';
  return null;
}

function normaliseStatus(raw: string | undefined | null): KycStatus {
  return ((raw ?? 'unverified').toLowerCase()) as KycStatus;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBanner({
  status,
  rejectionReason,
  onResubmit,
}: {
  status: KycStatus;
  rejectionReason?: string | null;
  onResubmit?: () => void;
}) {
  if (status === 'unverified') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-4">
        <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
        <p className="text-sm text-slate-300">Verify your identity to start selling</p>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-800/50 bg-amber-950/30 px-5 py-4">
        <svg className="w-5 h-5 text-amber-400 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <p className="text-sm text-amber-300">Under review — usually 1–3 business days</p>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-5 py-4">
        <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <p className="text-sm text-emerald-300 font-medium">Identity verified</p>
      </div>
    );
  }

  // rejected
  return (
    <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-5 py-4 space-y-3">
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        <p className="text-sm text-red-300 font-medium">Verification rejected</p>
      </div>
      {rejectionReason && (
        <p className="text-sm text-red-400 pl-8">{rejectionReason}</p>
      )}
      {onResubmit && (
        <div className="pl-8">
          <button
            onClick={onResubmit}
            className="text-sm font-medium text-amber-400 hover:text-amber-300 hover:underline transition-colors"
          >
            Resubmit documents →
          </button>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ step }: { step: number }) {
  const labels = ['Document', 'Front', 'Back', 'Selfie', 'Review'];
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {labels.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i < step ? 'bg-amber-500' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
      <div className="flex">
        {labels.map((label, i) => (
          <div key={i} className="flex-1 text-center">
            <span className={`text-xs ${i < step ? 'text-amber-400' : 'text-slate-600'}`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileDropZone({
  label,
  hint,
  file,
  error,
  onFile,
  onClear,
}: {
  label: string;
  hint?: string;
  file: File | null;
  error: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (file) {
    return (
      <div className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        {preview ? (
          <img
            src={preview}
            alt="preview"
            className="w-16 h-16 rounded-lg object-cover border border-slate-700 flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">{file.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        className={`rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-amber-400 bg-amber-400/5'
            : error
            ? 'border-red-700 hover:border-red-600'
            : 'border-slate-700 hover:border-amber-500/50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
      >
        <svg className="w-8 h-8 text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm text-slate-300">{label}</p>
        {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
        <p className="text-xs text-slate-600 mt-2">
          Drag & drop or{' '}
          <span className="text-amber-400">browse files</span>
          {' '}· JPG, PNG, PDF · Max 5 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function KycForm() {
  const { data: submission, isLoading } = useKycStatus();
  const submitKyc = useSubmitKyc();

  const kycStatus = normaliseStatus(submission?.status);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>({
    docType: null,
    frontImage: null,
    backImage: null,
    selfieImage: null,
  });
  const [fileErrors, setFileErrors] = useState<Partial<Record<'front' | 'back' | 'selfie', string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const docOption = DOC_TYPES.find((d) => d.value === wizard.docType);
  const isDirty = !!(wizard.docType || wizard.frontImage);

  // Warn on navigation if wizard is in progress
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  function resetWizard() {
    setWizard({ docType: null, frontImage: null, backImage: null, selfieImage: null });
    setFileErrors({});
    setSubmitError(null);
    setStep(1);
  }

  function handleResubmit() {
    resetWizard();
    setWizardOpen(true);
  }

  function pickFile(field: 'frontImage' | 'backImage' | 'selfieImage', file: File) {
    const errKey = field.replace('Image', '') as 'front' | 'back' | 'selfie';
    const err = validateFile(file);
    if (err) {
      setFileErrors((prev) => ({ ...prev, [errKey]: err }));
      return;
    }
    setFileErrors((prev) => { const next = { ...prev }; delete next[errKey]; return next; });
    setWizard((prev) => ({ ...prev, [field]: file }));
  }

  function clearFile(field: 'frontImage' | 'backImage' | 'selfieImage') {
    const errKey = field.replace('Image', '') as 'front' | 'back' | 'selfie';
    setWizard((prev) => ({ ...prev, [field]: null }));
    setFileErrors((prev) => { const next = { ...prev }; delete next[errKey]; return next; });
  }

  function canAdvance(): boolean {
    if (step === 1) return !!wizard.docType;
    if (step === 2) return !!wizard.frontImage && !fileErrors.front;
    if (step === 3) return (!!wizard.backImage && !fileErrors.back) || !docOption?.requiresBack;
    if (step === 4) return !!wizard.selfieImage && !fileErrors.selfie;
    return true;
  }

  function nextStep() { setStep((s) => Math.min(s + 1, 5)); }
  function prevStep() { setStep((s) => Math.max(s - 1, 1)); }

  async function handleSubmit() {
    if (!wizard.docType || !wizard.frontImage || !wizard.selfieImage) return;
    setSubmitError(null);
    const fd = new FormData();
    fd.append('documentType', wizard.docType);
    fd.append('frontImage', wizard.frontImage);
    if (wizard.backImage) fd.append('backImage', wizard.backImage);
    fd.append('selfieImage', wizard.selfieImage);
    try {
      await submitKyc.mutateAsync(fd);
      resetWizard();
      setWizardOpen(false);
    } catch (e) {
      setSubmitError((e as Error)?.message ?? 'Submission failed. Please try again.');
    }
  }

  // ── Render: loading ──
  if (isLoading) {
    return <div className="h-32 rounded-xl bg-slate-800 animate-pulse" />;
  }

  const showForm =
    (kycStatus === 'unverified') ||
    (kycStatus === 'rejected' && wizardOpen);

  return (
    <div className="space-y-6">
      {/* Status banner — always at top */}
      <StatusBanner
        status={kycStatus}
        rejectionReason={submission?.rejectionReason}
        onResubmit={kycStatus === 'rejected' ? handleResubmit : undefined}
      />

      {/* Wizard form */}
      {showForm && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 space-y-6">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Identity Verification</h3>
              <span className="text-xs text-slate-500">Step {step} of 5</span>
            </div>
            <ProgressBar step={step} />
          </div>

          {/* Navigation warning */}
          {isDirty && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-2.5">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <p className="text-xs text-amber-300">Your progress will be lost if you navigate away</p>
            </div>
          )}

          {/* ── Step 1: Document type ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Select the type of identity document you'll be uploading
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DOC_TYPES.map((dt) => (
                  <button
                    key={dt.value}
                    onClick={() => setWizard((prev) => ({ ...prev, docType: dt.value }))}
                    className={`rounded-xl border p-4 text-left transition-all space-y-2 ${
                      wizard.docType === dt.value
                        ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                        : 'border-slate-700 bg-slate-900/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                          wizard.docType === dt.value
                            ? 'border-amber-500 bg-amber-500'
                            : 'border-slate-600'
                        }`}
                      />
                      <span className="text-sm font-medium text-white">{dt.label}</span>
                    </div>
                    <ul className="space-y-0.5 pl-6">
                      {dt.requirements.map((r) => (
                        <li key={r} className="text-xs text-slate-500">· {r}</li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Front image ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-white mb-1">
                  {docOption?.frontLabel ?? 'Front of document'}
                </h4>
                <p className="text-xs text-slate-500">
                  Make sure all text is clearly visible and the document isn't cut off
                </p>
              </div>
              <FileDropZone
                label="Drop your front image here"
                file={wizard.frontImage}
                error={fileErrors.front ?? null}
                onFile={(f) => pickFile('frontImage', f)}
                onClear={() => clearFile('frontImage')}
              />
            </div>
          )}

          {/* ── Step 3: Back image ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-medium text-white mb-1">
                    {docOption?.requiresBack ? (docOption.backLabel || 'Back of document') : 'Back image'}
                  </h4>
                  <p className="text-xs text-slate-500">Make sure all text is clearly visible</p>
                </div>
                {!docOption?.requiresBack && (
                  <button
                    onClick={() => setStep(4)}
                    className="text-xs text-amber-400 hover:underline flex-shrink-0 mt-0.5"
                  >
                    Skip this step →
                  </button>
                )}
              </div>

              {docOption?.requiresBack ? (
                <FileDropZone
                  label="Drop your back image here"
                  file={wizard.backImage}
                  error={fileErrors.back ?? null}
                  onFile={(f) => pickFile('backImage', f)}
                  onClear={() => clearFile('backImage')}
                />
              ) : (
                <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-8 text-center space-y-3">
                  <p className="text-sm text-slate-400">
                    Passports only require the photo/bio-data page — no back image needed.
                  </p>
                  <button
                    onClick={() => setStep(4)}
                    className="text-sm text-amber-400 hover:underline"
                  >
                    Continue to selfie →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Selfie ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Selfie with your document</h4>
                <div className="flex items-start gap-3 rounded-lg border border-blue-800/40 bg-blue-950/20 px-4 py-3">
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                  </svg>
                  <p className="text-sm text-blue-300">
                    Hold your ID next to your face. Both your face and the document must be clearly visible.
                  </p>
                </div>
              </div>
              <FileDropZone
                label="Drop your selfie here"
                hint="Face + document clearly visible in a single photo"
                file={wizard.selfieImage}
                error={fileErrors.selfie ?? null}
                onFile={(f) => pickFile('selfieImage', f)}
                onClear={() => clearFile('selfieImage')}
              />
            </div>
          )}

          {/* ── Step 5: Review & Submit ── */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Review your documents before submitting. You won't be able to change them after.
              </p>

              <div className="space-y-2">
                {/* Document type */}
                <div className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
                  <span className="text-xs text-slate-500 w-28 flex-shrink-0">Document type</span>
                  <span className="text-sm text-white capitalize">
                    {wizard.docType?.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Files */}
                {(
                  [
                    { field: 'frontImage', label: 'Front image' },
                    { field: 'backImage', label: 'Back image' },
                    { field: 'selfieImage', label: 'Selfie' },
                  ] as const
                ).map(({ field, label }) => {
                  const file = wizard[field];
                  if (!file) return null;
                  return (
                    <div
                      key={field}
                      className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3"
                    >
                      <span className="text-xs text-slate-500 w-28 flex-shrink-0">{label}</span>
                      <span className="text-sm text-white truncate flex-1">{file.name}</span>
                      <span className="text-xs text-slate-600">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  );
                })}
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3">
                  <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                  </svg>
                  <p className="text-sm text-red-400">{submitError}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Nav buttons ── */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            {step > 1 ? (
              <button
                onClick={prevStep}
                disabled={submitKyc.isPending}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <button
                onClick={nextStep}
                disabled={!canAdvance()}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitKyc.isPending || !wizard.frontImage || !wizard.selfieImage}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitKyc.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4Z" />
                    </svg>
                    Submitting…
                  </span>
                ) : (
                  'Submit for Review'
                )}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
