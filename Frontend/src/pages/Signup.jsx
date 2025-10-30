import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Eye, EyeOff, Check, Sparkles } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Signup = () => {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { register, error } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validatePassword = () => ({
    length: formData.password.length >= 6,
    match: formData.password === formData.confirmPassword && formData.confirmPassword !== ''
  });

  const passwordChecks = validatePassword();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords don't match");
      return;
    }
    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters long");
      return;
    }
    setLoading(true);
    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password
    });
    if (result.success) navigate('/dashboard');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-gray-950">
      {/* Left Side - Branding */}
      <motion.div 
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiIHN0cm9rZT0iIzFhMjAzZSIgc3Ryb2tlLXdpZHRoPSIyIiBvcGFjaXR5PSIuMSIvPjwvZz48L3N2Zz4=')] opacity-10" />
        
        <div className="relative z-10 flex items-center justify-center w-full p-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-md"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-5xl font-bold text-white">Join Scoutly</h1>
            </div>
            
            <p className="text-xl text-purple-100 mb-8">
              Transform your recruitment process today
            </p>
            
            <div className="space-y-4">
              {[
                { title: 'Smart Candidate Matching', desc: 'AI-powered sourcing from LinkedIn and beyond' },
                { title: 'Save Hours Every Week', desc: 'Automate repetitive sourcing tasks' },
                { title: 'Better Quality Hires', desc: 'Find candidates that truly fit your needs' }
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div className="w-8 h-8 bg-purple-400/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Check className="w-5 h-5 text-purple-100" />
                  </div>
                  <div>
                    <p className="font-semibold text-white mb-1">{feature.title}</p>
                    <p className="text-purple-100 text-sm">{feature.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-950 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 p-8">
            <div className="lg:hidden mb-8 text-center">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Scoutly
              </h1>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white mb-2">Create account</h2>
              <p className="text-gray-400">Start sourcing candidates in minutes</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg"
                >
                  <p className="font-medium">Error</p>
                  <p className="text-sm">{error}</p>
                </motion.div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Full Name</label>
                <Input name="name" type="text" required value={formData.name} onChange={handleChange} icon={User} placeholder="John Doe" />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Email address</label>
                <Input name="email" type="email" required value={formData.email} onChange={handleChange} icon={Mail} placeholder="you@example.com" />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Password</label>
                <div className="relative">
                  <Input name="password" type={showPassword ? 'text' : 'password'} required value={formData.password} onChange={handleChange} icon={Lock} placeholder="Create a password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">Confirm Password</label>
                <div className="relative">
                  <Input name="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} required value={formData.confirmPassword} onChange={handleChange} icon={Lock} placeholder="Confirm your password" />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300">
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {formData.password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-gray-800 rounded-lg p-3 space-y-2"
                >
                  <p className="text-xs font-semibold text-gray-300">Password requirements:</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.length ? 'bg-green-500' : 'bg-gray-700'}`}>
                      {passwordChecks.length && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className={`text-xs ${passwordChecks.length ? 'text-green-400' : 'text-gray-400'}`}>At least 6 characters</span>
                  </div>
                  {formData.confirmPassword && (
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordChecks.match ? 'bg-green-500' : 'bg-gray-700'}`}>
                        {passwordChecks.match && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-xs ${passwordChecks.match ? 'text-green-400' : 'text-gray-400'}`}>Passwords match</span>
                    </div>
                  )}
                </motion.div>
              )}

              <Button type="submit" loading={loading} className="w-full" size="lg" variant="primary">
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-indigo-400 hover:text-indigo-300 transition">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-gray-600">
            © 2025 Scoutly. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;