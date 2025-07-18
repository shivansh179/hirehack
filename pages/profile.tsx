import { GetServerSideProps } from 'next';
import { prisma } from '../lib/prisma';
import { verifyJwtToken } from '../lib/auth';
import type { User, Resume } from '@prisma/client';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { User as UserIcon, Briefcase, Target, Upload, LogOut } from 'lucide-react';

// The props type must exactly match what getServerSideProps provides
type ProfilePageProps = {
    user: User;
    resumes: Resume[];
};

export default function ProfilePage({ user, resumes }: ProfilePageProps) {
    const router = useRouter();
    // Initialize state directly from the correctly typed `user` prop
    const [formData, setFormData] = useState({
        name: user.name || '',
        experienceLevel: user.experienceLevel || '',
        careerGoal: user.careerGoal || '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState('');

    const handleSignOut = async () => {
        await fetch('/api/auth/signout');
        router.push('/sign-in');
    };

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage('');
        try {
            const res = await fetch('/api/profile/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            if (res.ok) {
                setMessage('Profile updated successfully!');
            } else {
                setMessage('Failed to update profile.');
            }
        } catch (err) {
            setMessage('An unexpected error occurred.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('resume', file);
        try {
            const res = await fetch('/api/resume/upload', {
                method: 'POST',
                body: formData,
            });
            if (res.ok) {
                router.replace(router.asPath);
                setMessage('Resume uploaded successfully!');
            } else {
                 setMessage('Resume upload failed.');
            }
        } catch (error) {
            setMessage('Resume upload failed.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
            <header className="flex justify-between items-center mb-8">
                <Button variant="secondary" onClick={() => router.push('/dashboard')}>← Back to Dashboard</Button>
                <h1 className="text-3xl font-bold text-center">Your Profile</h1>
                <Button variant="danger" onClick={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sign Out</Button>
            </header>
            
            <main className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Personal Information</CardTitle>
                        <CardDescription>Tell us a bit about yourself to personalize your interview experience.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium"><UserIcon size={16} /> Name</label>
                                <Input name="name" value={formData.name} onChange={handleFormChange} placeholder="e.g., Jane Doe" />
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium"><Briefcase size={16} /> Experience Level</label>
                                <Select name="experienceLevel" value={formData.experienceLevel} onChange={handleFormChange}>
                                    <option value="">Select Level</option>
                                    <option value="intern">Internship</option>
                                    <option value="entry">Entry-Level (0-2 years)</option>
                                    <option value="mid">Mid-Level (2-5 years)</option>
                                    <option value="senior">Senior (5+ years)</option>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-sm font-medium"><Target size={16} /> Career Goal</label>
                                <Input name="careerGoal" value={formData.careerGoal} onChange={handleFormChange} placeholder="e.g., Senior Frontend Developer" />
                            </div>
                            <Button type="submit" disabled={isSaving} className="w-full">
                                {isSaving ? 'Saving...' : 'Save Profile'}
                            </Button>
                            {message && <p className="text-center text-sm text-green-400 mt-2">{message}</p>}
                        </form>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Your Resumes</CardTitle>
                        <CardDescription>Manage your uploaded resumes here.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-medium"><Upload size={16} /> Upload New Resume (PDF)</label>
                            <Input type="file" accept=".pdf" onChange={handleFileChange} className="file:text-white" />
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-semibold">Uploaded:</h4>
                            {resumes.length > 0 ? (
                                <ul className="list-disc list-inside text-gray-300">
                                    {resumes.map(r => <li key={r.id}>{r.fileName}</li>)}
                                </ul>
                            ) : (
                                <p className="text-sm text-gray-500">No resumes uploaded yet.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

export const getServerSideProps: GetServerSideProps<ProfilePageProps> = async (ctx) => {
    const token = ctx.req.cookies.token;
    const verifiedToken = await verifyJwtToken(token);
    if (!verifiedToken?.userId) {
        return { redirect: { destination: '/sign-in', permanent: false } };
    }
    const userId = verifiedToken.userId as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const resumes = await prisma.resume.findMany({ where: { userId } });
    if (!user) {
        return { redirect: { destination: '/sign-in', permanent: false } };
    }
    return { 
        props: { 
            user: JSON.parse(JSON.stringify(user)), 
            resumes: JSON.parse(JSON.stringify(resumes)) 
        } 
    };
};