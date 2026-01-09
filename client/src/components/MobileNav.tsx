import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
    Menu, X, Search, Map, Route, User, Calendar, 
    Heart, Car, Home, LogOut, ChevronRight, Building2, Settings
} from 'lucide-react';

export default function MobileNav() {
    const { user, logout } = useAuth();
    const [location] = useLocation();
    const [isOpen, setIsOpen] = useState(false);

    const navItems = [
        { path: '/staging', label: 'Search', icon: Search },
        { path: '/staging/map', label: 'Map', icon: Map },
        { path: '/staging/chamber', label: 'Local Services', icon: Building2 },
    ];

    const userItems = user ? [
        { path: '/staging/reservations', label: 'My Reservations', icon: Calendar },
    ] : [];

    const hostItems = (user?.userType === 'host' || user?.userType === 'admin') ? [
        { path: '/host/dashboard', label: 'Host Dashboard', icon: Home },
    ] : [];

    const adminItems = user?.userType === 'admin' ? [
        { path: '/admin', label: 'Admin Console', icon: Settings },
    ] : [];

    const isActive = (path: string) => location === path;

    return (
        <>
            <header className="lg:hidden fixed top-0 left-0 right-0 bg-card border-b z-40">
                <div className="flex items-center justify-between px-4 py-3">
                    <Link href="/">
                        <span className="text-xl font-bold flex items-center gap-2">
                            <Car className="h-6 w-6 text-primary" />
                            BC Staging
                        </span>
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsOpen(!isOpen)}
                        data-testid="button-mobile-menu"
                    >
                        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </Button>
                </div>
            </header>

            {isOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <div 
                        className="absolute inset-0 bg-black/50"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-0 right-0 w-80 max-w-full h-full bg-card shadow-xl overflow-y-auto">
                        <div className="p-4">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-lg font-bold">Menu</h2>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>

                            {user ? (
                                <div className="bg-muted rounded-lg p-3 mb-4">
                                    <p className="font-medium">
                                        {user.firstName || user.email.split('@')[0]}
                                    </p>
                                    <p className="text-muted-foreground text-sm">{user.email}</p>
                                </div>
                            ) : (
                                <Link href="/host/login" onClick={() => setIsOpen(false)}>
                                    <Button className="w-full mb-4" data-testid="link-sign-in">
                                        Sign In
                                    </Button>
                                </Link>
                            )}

                            <nav className="space-y-1">
                                <p className="text-muted-foreground text-xs uppercase tracking-wider px-3 py-2">
                                    Explore
                                </p>
                                {navItems.map(item => (
                                    <Link
                                        key={item.path}
                                        href={item.path}
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <div className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer ${
                                            isActive(item.path)
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-muted'
                                        }`}>
                                            <item.icon className="h-5 w-5" />
                                            <span>{item.label}</span>
                                            <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
                                        </div>
                                    </Link>
                                ))}

                                {user && userItems.length > 0 && (
                                    <>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wider px-3 py-2 mt-4">
                                            My Account
                                        </p>
                                        {userItems.map(item => (
                                            <Link
                                                key={item.path}
                                                href={item.path}
                                                onClick={() => setIsOpen(false)}
                                            >
                                                <div className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer ${
                                                    isActive(item.path)
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'hover:bg-muted'
                                                }`}>
                                                    <item.icon className="h-5 w-5" />
                                                    <span>{item.label}</span>
                                                    <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
                                                </div>
                                            </Link>
                                        ))}
                                    </>
                                )}

                                {hostItems.length > 0 && (
                                    <>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wider px-3 py-2 mt-4">
                                            Host
                                        </p>
                                        {hostItems.map(item => (
                                            <Link
                                                key={item.path}
                                                href={item.path}
                                                onClick={() => setIsOpen(false)}
                                            >
                                                <div className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer ${
                                                    isActive(item.path)
                                                        ? 'bg-green-600 text-white'
                                                        : 'text-green-500 hover:bg-muted'
                                                }`}>
                                                    <item.icon className="h-5 w-5" />
                                                    <span>{item.label}</span>
                                                    <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
                                                </div>
                                            </Link>
                                        ))}
                                    </>
                                )}

                                {adminItems.length > 0 && (
                                    <>
                                        <p className="text-muted-foreground text-xs uppercase tracking-wider px-3 py-2 mt-4">
                                            Admin
                                        </p>
                                        {adminItems.map(item => (
                                            <Link
                                                key={item.path}
                                                href={item.path}
                                                onClick={() => setIsOpen(false)}
                                            >
                                                <div className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer ${
                                                    isActive(item.path)
                                                        ? 'bg-purple-600 text-white'
                                                        : 'text-purple-500 hover:bg-muted'
                                                }`}>
                                                    <item.icon className="h-5 w-5" />
                                                    <span>{item.label}</span>
                                                    <ChevronRight className="h-4 w-4 ml-auto opacity-50" />
                                                </div>
                                            </Link>
                                        ))}
                                    </>
                                )}
                            </nav>

                            {user && (
                                <button
                                    onClick={() => { logout(); setIsOpen(false); }}
                                    className="w-full mt-6 flex items-center gap-3 px-3 py-3 text-destructive hover:bg-muted rounded-lg"
                                    data-testid="button-logout"
                                >
                                    <LogOut className="h-5 w-5" />
                                    <span>Sign Out</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-40">
                <div className="flex justify-around py-2">
                    {navItems.map(item => (
                        <Link key={item.path} href={item.path}>
                            <div className={`flex flex-col items-center py-1 px-3 cursor-pointer ${
                                isActive(item.path) ? 'text-primary' : 'text-muted-foreground'
                            }`}>
                                <item.icon className="h-5 w-5" />
                                <span className="text-xs mt-1">{item.label}</span>
                            </div>
                        </Link>
                    ))}
                    {user && (
                        <Link href="/staging/reservations">
                            <div className={`flex flex-col items-center py-1 px-3 cursor-pointer ${
                                isActive('/staging/reservations') ? 'text-primary' : 'text-muted-foreground'
                            }`}>
                                <Calendar className="h-5 w-5" />
                                <<span className="text-xs mt-1">Reservations</span>
                            </div>
                        </Link>
                    )}
                    <button
                        onClick={() => setIsOpen(true)}
                        className="flex flex-col items-center py-1 px-3 text-muted-foreground"
                        data-testid="button-more-menu"
                    >
                        <Menu className="h-5 w-5" />
                        <span className="text-xs mt-1">More</span>
                    </button>
                </div>
            </nav>

            <div className="lg:hidden h-14" />
        </>
    );
}
