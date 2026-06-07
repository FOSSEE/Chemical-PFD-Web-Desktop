export async function appendFooterToImage(
    dataUrl: string,
    projectName: string,
    createdBy: string,
    date: string,
    backgroundColor: string,
    scale: number = 2
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                return reject(new Error("Failed to get 2d context"));
            }

            const blockWidth = Math.min(360 * scale, Math.max(250 * scale, img.width * 0.34));
            const blockHeight = 92 * scale;
            const margin = 24 * scale;

            // Keep original image dimensions; draw footer inside the existing bounds
            canvas.width = img.width;
            canvas.height = img.height;

            // Fill background
            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw original diagram image
            ctx.drawImage(img, 0, 0);

            // Calculate position for the footer block (bottom-right of existing image bounds)
            const x = canvas.width - blockWidth - margin;
            const y = canvas.height - blockHeight - margin;

            // Draw footer block background and border
            ctx.fillStyle = "#FFF8F2";
            ctx.strokeStyle = "#C97B5A";
            ctx.lineWidth = 1.5 * scale;

            // Rounded rectangle
            ctx.beginPath();
            ctx.roundRect(x, y, blockWidth, blockHeight, 8 * scale);
            ctx.fill();
            ctx.stroke();

            // Text setup
            ctx.fillStyle = "#6B4A3B";
            const labelFontSize = 11 * scale;
            const valueFontSize = 12 * scale;
            const lineGap = 24 * scale;
            const textX = x + 16 * scale;
            const labelY = y + 26 * scale;

            const rows = [
                { label: "Project Name:", value: projectName },
                { label: "Created By:", value: createdBy },
                { label: "Date:", value: date },
            ];

            rows.forEach((row, index) => {
                const rowY = labelY + index * lineGap;

                ctx.font = `bold ${labelFontSize}px sans-serif`;
                ctx.fillText(row.label, textX, rowY);

                ctx.font = `normal ${valueFontSize}px sans-serif`;
                ctx.fillText(row.value, textX + 110 * scale, rowY);
            });

            resolve(canvas.toDataURL("image/png", 1.0));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
}

export function getReportFooterHTML(
    projectName: string,
    createdBy: string,
    date: string
): string {
    return `
    <div class="title-block" style="
      width: 320px;
      background-color: #FFF8F2;
      border: 2px solid #C97B5A;
      border-radius: 8px;
      padding: 14px 16px;
      margin-left: auto;
      margin-top: 40px;
      page-break-inside: avoid;
      box-sizing: border-box;
    ">
      <table style="width: 100%; border-collapse: collapse; border: none;">
        <tr style="border: none;">
          <td style="padding: 5px 0; font-weight: bold; color: #6B4A3B; font-size: 10pt; width: 110px; white-space: nowrap; border: none;">Project Name:</td>
          <td style="padding: 5px 0; color: #6B4A3B; font-size: 10pt; border: none;">${projectName}</td>
        </tr>
        <tr style="border: none;">
          <td style="padding: 5px 0; font-weight: bold; color: #6B4A3B; font-size: 10pt; width: 110px; white-space: nowrap; border: none;">Created By:</td>
          <td style="padding: 5px 0; color: #6B4A3B; font-size: 10pt; border: none;">${createdBy}</td>
        </tr>
        <tr style="border: none;">
          <td style="padding: 5px 0; font-weight: bold; color: #6B4A3B; font-size: 10pt; width: 110px; white-space: nowrap; border: none;">Date:</td>
          <td style="padding: 5px 0; color: #6B4A3B; font-size: 10pt; border: none;">${date}</td>
        </tr>
      </table>
    </div>
  `;
}
