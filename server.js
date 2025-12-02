// server.js
import express from "express";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import AdmZip from "adm-zip";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json({ limit: "50mb" }));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/extract-pdfs", (req, res) => {
  try {
    const { zipBase64 } = req.body || {};

    if (!zipBase64) {
      return res.status(400).json({
        error: "Missing 'zipBase64' in body",
      });
    }

    const zipBuffer = Buffer.from(zipBase64, "base64");
    const zip = new AdmZip(zipBuffer);

    const pdfEntries = zip
      .getEntries()
      .filter(
        (entry) =>
          !entry.isDirectory && entry.entryName.toLowerCase().endsWith(".pdf")
      );

    if (!pdfEntries.length) {
      return res.status(404).json({
        error: "No PDF files found in ZIP",
      });
    }

    const files = pdfEntries.map((entry) => ({
      filename: path.basename(entry.entryName),
      fileBase64: entry.getData().toString("base64"),
    }));

    return res.json({
      success: true,
      files,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: "Failed to extract PDFs from ZIP",
      details: e?.message,
    });
  }
});

app.post("/unlock", (req, res) => {
  try {
    const { password, fileBase64, returnBase64 } = req.body || {};

    if (!password || !fileBase64) {
      return res.status(400).json({
        error: "Missing 'password' or 'fileBase64' in body",
      });
    }

    const inputPath = path.join(__dirname, "input.pdf");
    const outputPath = path.join(__dirname, "output.pdf");

    const buffer = Buffer.from(fileBase64, "base64");
    fs.writeFileSync(inputPath, buffer);

    execFile(
      "qpdf",
      [`--password=${password}`, "--decrypt", inputPath, outputPath],
      (err, stdout, stderr) => {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

        if (err) {
          console.error("qpdf error:", err, stderr);
          return res.status(500).json({
            error: "Failed to decrypt PDF",
            details: stderr?.toString(),
          });
        }

        if (!fs.existsSync(outputPath)) {
          return res
            .status(500)
            .json({ error: "Decrypted file not found after qpdf" });
        }

        const outBuffer = fs.readFileSync(outputPath);
        fs.unlinkSync(outputPath);

        if (!returnBase64) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            "attachment; filename=unlocked.pdf"
          );
          return res.send(outBuffer);
        }

        const outBase64 = outBuffer.toString("base64");
        return res.json({
          success: true,
          fileBase64: outBase64,
        });
      }
    );
  } catch (e) {
    console.error(e);
    return res.status(500).json({
      error: "Unexpected server error",
      details: e?.message,
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`PDF unlocker listening on port ${port}`);
});
