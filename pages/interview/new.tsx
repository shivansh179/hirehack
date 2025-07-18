// pages/interview/new.tsx
import { GetServerSideProps } from 'next';
import { prisma } from '../../lib/prisma';
import { verifyJwtToken } from '../../lib/auth';
import type { Resume } from '@prisma/client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import Link from 'next/link';
import React from 'react';

// ✅ Add this missing type definition
interface NewInterviewProps {
  resumes: Resume[];
}

export default function NewInterviewPage({ resumes }: NewInterviewProps) {
  const router = useRouter();
  const [selectedResumeId, setSelectedResumeId] = useState(resumes[0]?.id || '');
  const [duration, setDuration] = useState('15');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResumeId) {
      setError('Please upload a resume first by visiting your profile.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch('/api/interview/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeId: selectedResumeId,
          durationMinutes: parseInt(duration),
        }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const data = await res.json();
      router.push(`/interview/${data.sessionId}`);
    } catch (err) {
      setError('Could not start interview. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>New Mock Interview</CardTitle>
          <CardDescription>Configure your session and let's get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Resume Selection */}
            <div className="space-y-2">
              <label htmlFor="resume">Select Resume</label>
              <Select
                id="resume"
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
              >
                {resumes.map((r) => (
                  <option key={r.id as React.Key} value={r.id}>
                    {r.fileName}
                  </option>
                ))}
              </Select>
              {resumes.length === 0 && (
                <p className="text-xs text-yellow-400">
                  No resumes found. Please{' '}
                  <Link href="/profile" className="underline">
                    upload one
                  </Link>.
                </p>
              )}
            </div>

            {/* Duration Selection */}
            <div className="space-y-2">
              <label htmlFor="duration">Interview Duration</label>
              <Select
                id="duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              >
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="45">45 Minutes</option>
              </Select>
            </div>

            {/* Error Display */}
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {/* Buttons */}
            <Button type="submit" disabled={isLoading || resumes.length === 0} className="w-full">
              {isLoading ? 'Starting...' : 'Start Interview'}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => router.push('/dashboard')}
              className="w-full"
            >
              Cancel
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ✅ Server-side props to fetch resumes
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = ctx.req.cookies.token;
  const verifiedToken = await verifyJwtToken(token);

  if (!verifiedToken?.userId) {
    return { redirect: { destination: '/sign-in', permanent: false } };
  }

  const resumes = await prisma.resume.findMany({
    where: { userId: verifiedToken.userId as string },
  });

  return {
    props: {
      resumes: JSON.parse(JSON.stringify(resumes)) as Resume[],
    },
  };
};
