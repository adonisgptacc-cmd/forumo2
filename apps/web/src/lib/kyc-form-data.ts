export interface KycUploadFiles {
  documentType: string;
  frontImage: File;
  backImage?: File | null;
  selfieImage: File;
}

export function buildKycFormData(upload: KycUploadFiles): FormData {
  const documents = [
    { file: upload.frontImage, type: `${upload.documentType}_front` },
    ...(upload.backImage
      ? [{ file: upload.backImage, type: `${upload.documentType}_back` }]
      : []),
    { file: upload.selfieImage, type: "selfie" },
  ];
  const formData = new FormData();

  documents.forEach(({ file }) => formData.append("documents", file));
  formData.append(
    "documentTypes",
    JSON.stringify(documents.map(({ type }) => type)),
  );

  return formData;
}
