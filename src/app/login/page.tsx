'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Container, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
      return;
    }

    setIsLoggingIn(true);
    const result = await login(username, password);
    
    if (result.success) {
      // Customer role → Portal, others → Dashboard
      const session = JSON.parse(localStorage.getItem('cyms_session') || '{}');
      router.push(session.role === 'customer' ? '/portal' : '/dashboard');
    } else {
      setError(result.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 40%, #0F172A 100%)',
      }}
    >
      {/* Animated Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #10B981 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #3B82F6 0%, transparent 70%)' }} />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/10 shadow-2xl p-8">
          {/* Logo Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#2563EB] flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
              <Container size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">CYMS</h1>
            <p className="text-slate-400 text-sm">ระบบบริหารจัดการลานตู้คอนเทนเนอร์อัจฉริยะ</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm animate-[fadeIn_0.2s_ease]">
                <AlertCircle size={16} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2">
                ชื่อผู้ใช้ (Username)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้"
                className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500
                  focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-200"
                autoComplete="username"
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-2">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full h-12 px-4 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500
                    focus:border-[#3B82F6] focus:ring-2 focus:ring-blue-500/20 outline-none transition-all duration-200"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#2563EB]
                text-white font-semibold text-sm
                hover:from-[#2563EB] hover:to-[#1D4ED8]
                active:scale-[0.98] transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40
                flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={18} />
                  เข้าสู่ระบบ
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          © 2024 CYMS — Smart Container Yard Management System
        </p>
      </div>
    </div>
  );
}
