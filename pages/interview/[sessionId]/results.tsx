import { GetServerSideProps } from 'next';
import { prisma } from '../../../lib/prisma';
import { verifyJwtToken } from '../../../lib/auth';
import type { InterviewSession } from '@prisma/client';
import { useRouter } from 'next/router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Award, MessageSquareQuote, FileText } from 'lucide-react';

type ResultsPageProps = {
    session: InterviewSession;
    error?: string;
};

export default function ResultsPage({ session, error }: ResultsPageProps) {
    const router = useRouter();
    if (error) {
        return (
            <div className="flex flex-col gap-4 justify-center items-center min-h-screen bg-gray-900 text-white">
                <p className="text-red-400">{error}</p>
                <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
            </div>
        )
    }
    const scorePercentage = (session.score || 0) * 10;
    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
            <header className="text-center mb-10">
                <h1 className="text-4xl font-bold">Interview Complete!</h1>
                <p className="text-gray-400">Here's your performance breakdown.</p>
            </header>
            <main className="max-w-4xl mx-auto space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Award /> Overall Score</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                            <div className="w-full bg-gray-700 rounded-full h-4">
                                <div className="bg-green-500 h-4 rounded-full" style={{ width: `${scorePercentage}%` }}></div>
                            </div>
                            <span className="text-2xl font-bold">{session.score}/10</span>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><MessageSquareQuote /> AI Feedback</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-300 leading-relaxed">{session.feedback}</p>
                    </CardContent>
                </Card>
                <Card>
                     <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FileText /> Full Transcript</CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-60 overflow-y-auto space-y-2 text-sm bg-black/20 p-4 rounded-md">
                        {Array.isArray(session.messages) && session.messages.map((msg: any, i) => (
                             <p key={i} className={msg.sender === 'user' ? 'text-blue-300' : 'text-gray-300'}>
                                <strong>{msg.sender === 'user' ? 'You:' : 'Interviewer:'}</strong> {msg.text}
                            </p>
                        ))}
                    </CardContent>
                </Card>
                <div className="text-center">
                    <Button onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
                </div>
            </main>
        </div>
    );
}

export const getServerSideProps: GetServerSideProps<ResultsPageProps> = async (ctx) => {
    const token = ctx.req.cookies.token;
    const verifiedToken = await verifyJwtToken(token);
    if (!verifiedToken?.userId) {
        return { redirect: { destination: '/sign-in', permanent: false } };
    }
    const { sessionId } = ctx.params as { sessionId: string };
    const session = await prisma.interviewSession.findFirst({
        where: { id: sessionId, resume: { userId: verifiedToken.userId as string } }
    });
    if (!session) {
        return { props: { error: "Results not found or you do not have permission to view them." } as any };
    }
    if (session.status !== 'COMPLETED') {
        return { redirect: { destination: `/interview/${sessionId}`, permanent: false } };
    }
    return { props: { session: JSON.parse(JSON.stringify(session)) } };
};