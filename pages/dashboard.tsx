import { GetServerSideProps } from 'next';
import { prisma } from '../lib/prisma';
import { verifyJwtToken } from '../lib/auth';
import type { InterviewSession, Resume, User } from '@prisma/client';
import { useRouter } from 'next/router';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { PlusCircle, User as UserIcon, LogOut } from 'lucide-react';

type EnrichedSession = InterviewSession & { resume: { fileName: string } };
type DashboardProps = {
    user: User;
    sessions: EnrichedSession[];
};

export default function Dashboard({ user, sessions }: DashboardProps) {
    const router = useRouter();
    const handleSignOut = async () => {
        await fetch('/api/auth/signout');
        router.push('/sign-in');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Welcome, {user.name || 'User'}!</h1>
                    <p className="text-gray-400">Here's your interview dashboard.</p>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => router.push('/profile')}><UserIcon className="mr-2 h-4 w-4" />Profile</Button>
                    <Button variant="danger" onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sign Out</Button>
                </div>
            </header>

            <main className="space-y-8">
                <Card className="bg-blue-900/30 border-blue-700">
                    <CardHeader className="flex-row items-center justify-between">
                        <div className="space-y-1.5">
                            <CardTitle>Start a New Mock Interview</CardTitle>
                            <CardDescription>Practice makes perfect. Let's get you ready!</CardDescription>
                        </div>
                        <Button onClick={() => router.push('/interview/new')}>
                            <PlusCircle className="mr-2 h-4 w-4" /> New Interview
                        </Button>
                    </CardHeader>
                </Card>

                <div>
                    <h2 className="text-2xl font-semibold mb-4">Past Interviews</h2>
                    {sessions.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {sessions.map(session => (
                                <Card key={session.id}>
                                    <CardHeader>
                                        <CardTitle>Interview on {new Date(session.createdAt).toLocaleDateString()}</CardTitle>
                                        <CardDescription>Based on resume: {session.resume.fileName}</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex items-center justify-between">
                                        {session.status === 'COMPLETED' ? (
                                            <div className="text-left">
                                                <p className="text-gray-400 text-sm">Score</p>
                                                <p className="text-3xl font-bold text-green-400">{session.score}/10</p>
                                            </div>
                                        ) : (
                                            <Badge className="bg-yellow-500">In Progress</Badge>
                                        )}
                                        <p className="text-sm text-gray-400">{session.durationMinutes} min</p>
                                    </CardContent>
                                    <CardFooter>
                                        <Button
                                            onClick={() => router.push(session.status === 'COMPLETED' ? `/interview/${session.id}/results` : `/interview/${session.id}`)}
                                            className="w-full"
                                            variant={session.status === 'COMPLETED' ? 'secondary' : 'primary'}
                                        >
                                            {session.status === 'COMPLETED' ? 'View Results' : 'Continue Interview'}
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 border-2 border-dashed border-gray-700 rounded-lg">
                            <p className="text-gray-500">You haven't completed any interviews yet.</p>
                            <p className="text-gray-500">Click "New Interview" to get started!</p>
                        </div>
                    )}
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

    const userId = verifiedToken.userId as string;

    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        // This can happen if the user was deleted but the cookie remains
        return { redirect: { destination: '/sign-in', permanent: false } };
    }

    const sessions = await prisma.interviewSession.findMany({
        where: { resume: { userId: userId } },
        include: { resume: { select: { fileName: true } } },
        orderBy: { createdAt: 'desc' },
    });

    // We must use JSON.parse(JSON.stringify(...)) to serialize Date objects
    return { 
        props: { 
            user: JSON.parse(JSON.stringify(user)), 
            sessions: JSON.parse(JSON.stringify(sessions)) 
        } 
    };
};