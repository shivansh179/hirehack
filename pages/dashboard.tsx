import { GetServerSideProps } from 'next';
import prisma from '../lib/prisma';
import type { Resume } from '@prisma/client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { verifyJwtToken } from '../lib/auth';

type DashboardProps = {
  resumes: Resume[];
  user: { email: string };
};

const Header = ({ userEmail }: {userEmail: string}) => {
    const router = useRouter();
    const handleSignOut = async () => {
        await fetch('/api/auth/signout');
        router.push('/sign-in');
    };
    return (
        <header className="flex justify-between items-center p-4 border-b border-gray-700">
            <h1 className="text-2xl font-bold">Your Dashboard</h1>
            <div className="flex items-center gap-4">
                <span className="text-gray-300">{userEmail}</span>
                <button onClick={handleSignOut} className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded-md text-sm">Sign Out</button>
            </div>
        </header>
    )
}

export default function Dashboard({ resumes: initialResumes, user }: DashboardProps) {
  const [resumes, setResumes] = useState(initialResumes);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await fetch('/api/resume/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Upload failed');
      }

      const newResumeData = await res.json();
      setResumes((prev) => [...prev, newResumeData]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (event.target) event.target.value = '';
    }
  };
  
  const startInterview = async (resumeId: string) => {
    try {
      const res = await fetch('/api/interview/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId }),
      });
      if (!res.ok) throw new Error('Failed to start interview');
      const { sessionId } = await res.json();
      router.push(`/interview/${sessionId}`);
    } catch (err: any) {
      setError(err.message || 'Could not start a new interview session. Please try again.');
    }
  };


  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Header userEmail={user.email} />
      <main className="p-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-semibold mb-6">Your Resumes</h2>
          {error && <p className="bg-red-900/50 text-red-300 p-3 rounded-md mb-4">{error}</p>}

          <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
            <h3 className="text-xl font-bold mb-4">Upload a New Resume</h3>
            <p className="text-gray-400 mb-4">Upload your resume in PDF format to get started.</p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={uploading}
              className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
            />
            {uploading && <p className="mt-2 text-blue-400 animate-pulse">Uploading and processing...</p>}
          </div>

          <div className="space-y-4">
            {resumes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">You haven't uploaded any resumes yet.</p>
            ) : (
                resumes.map((resume) => (
                <div key={resume.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                    <div>
                        <p className="font-bold">{resume.fileName}</p>
                        <p className="text-sm text-gray-400">Uploaded on {new Date(resume.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button
                        onClick={() => startInterview(resume.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-full font-semibold transition-transform transform hover:scale-105"
                    >
                        ▶️ Start Interview
                    </button>
                </div>
                ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = ctx.req.cookies.token;
  const verifiedToken = await verifyJwtToken(token);
  
  if (!verifiedToken?.userId) {
    return { redirect: { destination: '/sign-in', permanent: false } };
  }

  const resumes = await prisma.resume.findMany({
    where: { userId: verifiedToken.userId as string },
    orderBy: { createdAt: 'desc' },
  });

  return { props: { 
        resumes: JSON.parse(JSON.stringify(resumes)),
        user: { email: verifiedToken.email }
    } };
};