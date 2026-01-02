import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Loader2 } from 'lucide-react';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'login' | 'register';
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
    const { login, register } = useAuth();
    const [mode, setMode] = useState<'login' | 'register'>(initialMode);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [userType, setUserType] = useState('guest');
    const [companyName, setCompanyName] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                if (password !== confirmPassword) {
                    setError('Passwords do not match');
                    setLoading(false);
                    return;
                }
                await register({
                    email,
                    password,
                    firstName: firstName || undefined,
                    lastName: lastName || undefined,
                    userType,
                    companyName: companyName || undefined
                });
            }
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setFirstName('');
        setLastName('');
        setUserType('guest');
        setCompanyName('');
        setError(null);
    }

    function switchMode(newMode: 'login' | 'register') {
        resetForm();
        setMode(newMode);
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </DialogTitle>
                </DialogHeader>

                {error && (
                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded-md text-sm" data-testid="auth-error">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'register' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                    id="firstName"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    data-testid="input-first-name"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                    id="lastName"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    data-testid="input-last-name"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            data-testid="input-email"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            data-testid="input-password"
                        />
                    </div>

                    {mode === 'register' && (
                        <>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    data-testid="input-confirm-password"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="userType">I am a...</Label>
                                <Select value={userType} onValueChange={setUserType}>
                                    <SelectTrigger data-testid="select-user-type">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="guest">Traveler / RV Owner</SelectItem>
                                        <SelectItem value="crew_manager">Crew Manager</SelectItem>
                                        <SelectItem value="host">Property Host</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {(userType === 'crew_manager' || userType === 'host') && (
                                <div className="space-y-2">
                                    <Label htmlFor="companyName">Company Name</Label>
                                    <Input
                                        id="companyName"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        data-testid="input-company-name"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <Button type="submit" className="w-full" disabled={loading} data-testid="button-auth-submit">
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                    </Button>
                </form>

                <div className="text-center text-sm text-muted-foreground">
                    {mode === 'login' ? (
                        <>
                            Don't have an account?{' '}
                            <button 
                                onClick={() => switchMode('register')} 
                                className="text-primary hover:underline"
                                data-testid="link-switch-to-register"
                            >
                                Sign up
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <button 
                                onClick={() => switchMode('login')} 
                                className="text-primary hover:underline"
                                data-testid="link-switch-to-login"
                            >
                                Sign in
                            </button>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
