// Resize an image File in the browser and return a compressed data URL, so
// logos / signatures are stored small (base64 in the DB) without a file-upload
// backend. PNG output preserves transparency for logos and signature cut-outs.

export function fileToResizedDataUrl(
  file,
  { maxEdge = 400, mime = "image/png", quality = 0.92 } = {}
) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type?.startsWith("image/")) {
      return reject(new Error("Please choose an image file."));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't a valid image."));
      img.onload = () => {
        const longest = Math.max(img.width, img.height) || 1;
        const scale = Math.min(1, maxEdge / longest);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(mime, quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
