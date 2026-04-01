'use client';

import { useState, useRef } from 'react';
import { useKycStatus, useSubmitKyc, KycSubmission } from '../../../../lib/react-query/hooks';

const DOCUMENT_TYPES = [
  { value: 'national_id', label: 'National ID' },
  { value: 'passport', label: 'Passport' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'utility_bill', label: 'Utility Bill (proof of address)' },
  { value: 'bank_statement', label: 'Bank Statement' },
];

function StatusBadge({ status }: { status: KycSubmission['status'] }) {
  const map = {
    PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    REJECTED: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${map[status]}`}>
      {status === 'PENDING' && '⏳ '}
      {status === 'APPROVED' && '✓ '}
      {status === 'REJECTED' && '✗ '}
      {status}
    </span>
  );
}

interface DocEntry {
  file: File;
  type: string;
}

export function KycForm() {
  const { data: submission, isLoading } = useKycStatus();
  const submitKyc = useSubmitKyc();

  const [docs, setDocs] = useState<DocEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const newDocs = Array.from(files).slice(0, 5 - docs.length).map((file) => ({
      file,
      type: 'national_id',
    }));
    setDocs((prev) => [...prev, ...newDocs]);
  };

  const removeDoc = (index: number) => {
    setDocs((prev) => prev.filter((_, i) => i !== index));
  };

  const updateType = (index: number, type: string) => {
    setDocs((prev) => prev.map((d, i) => (i === index ? { ...d, type } : d)));
  };

  const handleSubmit = async () => {
    if (docs.length === 0) return;
    const formData = new FormData();
    docs.forEach((d) => formData.append('documents', d.file));
    formData.append('documentTypes', JSON.stringify(docs.map((d) => d.type)));
    await submitKyc.mutateAsync(formData);
    setDocs([]);
  };

  if (isLoading) {
    return <div className="h-48 rounded-xl bg-slate-800 animate-pulse" />;
  }

  // Show status if already submitted
  if (submission) {
    return (
      <div className="space-y-6">
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">KYC Status</h3>
            <StatusBadge status={submission.status} />
          </div>

          <p className="text-sm text-slate-400">
            Submitted {new Date(submission.submittedAt).toLocaleDateString()}
            {submission.reviewedAt && ` · Reviewed ${new Date(submission.reviewedAt).toLocaleDateString()}`}
          </p>

          {submission.status === 'REJECTED' && submission.rejectionReason && (
            <div className="rounded-lg border border-red-800 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              <strong>Rejection reason:</strong> {submission.rejectionReason}
            </div>
          )}

          {submission.status === 'APPROVED' && (
            <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
              Your identity has been verified. You can now list products and accept payments.
            </div>
          )}

          {submission.status === 'PENDING' && (
            <div className="rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
              Your documents are under review. This typically takes 1–2 business days.
            </div>
          )}

          {/* Submitted docs */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Submitted documents</p>
            <ul className="space-y-1">
              {submission.documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="text-slate-500">·</span>
                  <span className="capitalize">{doc.type.replace(/_/g, ' ')}</span>
                  <span className={`text-xs ${doc.status === 'APPROVED' ? 'text-emerald-400' : doc.status === 'REJECTED' ? 'text-red-400' : 'text-amber-400'}`}>
                    ({doc.status})
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Allow resubmission if rejected */}
          {submission.status === 'REJECTED' && (
            <ResubmitForm />
          )}
        </section>
      </div>
    );
  }

  // No submission yet — show form
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 space-y-5">
      <div>
        <h3 className="font-semibold">Submit KYC Documents</h3>
        <p className="text-sm text-slate-400 mt-1">
          Upload identity documents to verify your account. Accepted: National ID, Passport, Driver's License, or proof of address.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className="rounded-lg border-2 border-dashed border-slate-700 p-8 text-center cursor-pointer hover:border-amber-500/40 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          addFiles(e.dataTransfer.files);
        }}
      >
        <p className="text-sm text-slate-400">
          Drag & drop files here or <span className="text-amber-400">browse</span>
        </p>
        <p className="text-xs text-slate-600 mt-1">JPG, PNG, or PDF · Max 5 files · 10 MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map((doc, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{doc.file.name}</p>
                <p className="text-xs text-slate-500">{(doc.file.size / 1024).toFixed(0)} KB</p>
              </div>
              <select
                value={doc.type}
                onChange={(e) => updateType(i, e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>{dt.label}</option>
                ))}
              </select>
              <button
                onClick={() => removeDoc(i)}
                className="text-slate-500 hover:text-red-400 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {submitKyc.isError && (
        <p className="text-xs text-red-400">{(submitKyc.error as Error)?.message}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={docs.length === 0 || submitKyc.isPending}
        className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitKyc.isPending ? 'Uploading…' : `Submit ${docs.length > 0 ? `${docs.length} document${docs.length > 1 ? 's' : ''}` : 'documents'}`}
      </button>
    </section>
  );
}

function ResubmitForm() {
  const submitKyc = useSubmitKyc();
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setDocs((prev) => [...prev, ...Array.from(files).slice(0, 5 - prev.length).map((file) => ({ file, type: 'national_id' }))]);
  };

  const handleSubmit = async () => {
    if (docs.length === 0) return;
    const formData = new FormData();
    docs.forEach((d) => formData.append('documents', d.file));
    formData.append('documentTypes', JSON.stringify(docs.map((d) => d.type)));
    await submitKyc.mutateAsync(formData);
    setDocs([]);
    setOpen(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-amber-400 hover:underline">
        Resubmit documents →
      </button>
    );
  }

  return (
    <div className="space-y-3 border-t border-slate-800 pt-4">
      <p className="text-sm font-medium text-white">Upload new documents</p>
      <input type="file" multiple accept="image/*,.pdf" ref={fileInputRef} className="hidden" onChange={(e) => addFiles(e.target.files)} />
      <button onClick={() => fileInputRef.current?.click()} className="text-xs text-amber-400 hover:underline">Browse files</button>
      {docs.length > 0 && (
        <ul className="space-y-1">
          {docs.map((d, i) => (
            <li key={i} className="flex items-center gap-2 text-xs text-slate-300">
              <span>{d.file.name}</span>
              <select value={d.type} onChange={(e) => setDocs((prev) => prev.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} className="rounded border border-slate-700 bg-slate-900 px-1 py-0.5 text-xs text-white">
                {DOCUMENT_TYPES.map((dt) => <option key={dt.value} value={dt.value}>{dt.label}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <button onClick={handleSubmit} disabled={docs.length === 0 || submitKyc.isPending} className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 disabled:opacity-50">
          {submitKyc.isPending ? 'Uploading…' : 'Submit'}
        </button>
        <button onClick={() => { setOpen(false); setDocs([]); }} className="rounded-lg border border-slate-700 px-4 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Cancel</button>
      </div>
    </div>
  );
}
