// pages/sign-in.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (router.query.signedUp) {
      setSuccess('Your account was created! Please sign in.');
    }
  }, [router.query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const nextPath = router.query.next || '/dashboard';
        router.push(nextPath as string);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to sign in.');
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gray-950 text-white flex flex-col md:flex-row overflow-hidden">
      {/* Left Side - Branding */}
      <div className="relative w-full md:w-1/2 flex items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-white px-6 py-12">
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-6 max-w-md text-center"
        >
          <h2 className="text-4xl font-extrabold leading-tight">Welcome Back</h2>
          <p className="text-lg text-blue-100">Enter your credentials to access your dashboard.</p>
          <img src="/illustration-login.svg" alt="Sign in illustration" className="w-64 mx-auto hidden md:block" />
        </motion.div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 sm:p-16 bg-gray-900">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md space-y-6"
        >
          <h2 className="text-3xl font-bold text-center">Sign In to Your Account</h2>

          {success && <p className="text-green-400 text-sm text-center">{success}</p>}
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder=" "
                className="peer w-full px-4 py-3 bg-gray-800 text-white border border-gray-600 rounded-md placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="absolute left-4 top-2 text-sm  text-gray-400 transition-all peer-placeholder-shown:top-3.5  peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500 peer-focus:top-2  peer-focus:text-sm">
                Email address
              </label>
            </div>

            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder=" "
                className="peer w-full px-4 py-3 bg-gray-800 text-white border border-gray-600 rounded-md placeholder-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <label className="absolute left-4 top-2 text-sm text-gray-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-500 peer-focus:top-2 peer-focus:text-sm">
                Password
              </label>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold transition disabled:opacity-70"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </motion.button>
          </form>

          <div className="text-center mt-4">
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <Link href="/sign-up">
                <span className="text-blue-400 font-medium hover:underline">Create one</span>
              </Link>
            </p>
          </div>

          {/* Optional Social Sign In */}
          <div className="text-center mt-6">
            <p className="text-gray-500 text-sm mb-2">or sign in with</p>
            <button className="w-full flex items-center justify-center px-4 py-2 border border-gray-600 rounded-md hover:bg-gray-800 transition">
              <img src="/google-icon.svg" alt="google" className="w-5 h-5 mr-3" />
              Google
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
