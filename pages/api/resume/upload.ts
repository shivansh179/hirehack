// pages/api/resume/upload.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma'; // Corrected Import
import formidable, { Fields, Files, File } from 'formidable';
import fs from 'fs';
import pdf from 'pdf-parse';
import { getUserIdFromRequest } from '../../../lib/getUserFromRequest';

// The rest of this file is correct and remains the same
export const config = {
  api: {
    bodyParser: false,
  },
};
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const { files } = await new Promise<{fields: Fields, files: Files}>((resolve, reject) => {
        const form = formidable({});
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            resolve({ fields, files });
        });
    });
    const resumeFile = Array.isArray(files.resume) ? files.resume[0] : files.resume;
    if (!resumeFile) {
      return res.status(400).json({ error: 'No resume file provided.' });
    }
    const dataBuffer = fs.readFileSync(resumeFile.filepath);
    const pdfData = await pdf(dataBuffer);
    const newResume = await prisma.resume.create({
      data: {
        fileName: resumeFile.originalFilename || 'Untitled Resume',
        resumeText: pdfData.text,
        userId: userId,
      },
    });
    fs.unlinkSync(resumeFile.filepath);
    return res.status(200).json({ id: newResume.id, fileName: newResume.fileName, createdAt: newResume.createdAt, updatedAt: newResume.updatedAt });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}