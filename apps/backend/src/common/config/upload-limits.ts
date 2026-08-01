export const MAX_UPLOAD_FILE_SIZE_BYTES = 8 * 1024 * 1024;
export const MAX_UPLOAD_FILES = 5;
export const MAX_UPLOAD_FIELD_SIZE_BYTES = 64 * 1024;

export const uploadLimits = Object.freeze({
  fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
  files: MAX_UPLOAD_FILES,
  fields: 3,
  fieldSize: MAX_UPLOAD_FIELD_SIZE_BYTES,
  parts: MAX_UPLOAD_FILES + 3,
});
