import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, LogOut, Heart, Car, Calendar, MapPin, Settings } from 'lucide-react';
import AuthModal from './AuthModal';

export default function UserMenu() {
    const { user, loading, logout } = useAuth();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

    function openLogin() {
        setAuthMode('login');
        setShowAuthModal(true);
    }

    function openRegister() {
        setAuthMode('register');
        setShowAuthModal(true);
    }

    if (loading) {
        return (
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
        );
    }

    if (!user) {
        return (
            <>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={openLogin} data-testid="button-login">
                        Sign In
                    </Button>
                    <Button size="sm" onClick={openRegister} data-testid="button-register">
                        Sign Up
                    </Button>
                </div>
                <AuthModal 
                    isOpen={showAuthModal} 
                    onClose={() => setShowAuthModal(false)} 
                    initialMode={authMode}
                />
            </>
        );
    }

    const initials = [user.firstName?.[0], user.lastName?.[0]]
        .filter(Boolean)
        .join('')
        .toUpperCase() || user.email[0].toUpperCase();

    const displayName = user.firstName 
        ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
        : user.email;

    const userTypeLabels: Record<string, string> = {
        guest: 'Traveler',
        crew_manager: 'Crew Manager',
        host: 'Property Host',
        admin: 'Administrator'
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" data-testid="button-user-menu">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none" data-testid="text-user-name">{displayName}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        <p className="text-xs text-muted-foreground">{userTypeLabels[user.userType] || user.userType}</p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="menu-item-profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-vehicles">
                    <Car className="mr-2 h-4 w-4" />
                    My Vehicles
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-favorites">
                    <Heart className="mr-2 h-4 w-4" />
                    Favorites
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-reservations">
                    <Calendar className="mr-2 h-4 w-4" />
                    Reservations
                </DropdownMenuItem>
                <DropdownMenuItem data-testid="menu-item-trips">
                    <MapPin className="mr-2 h-4 w-4" />
                    Saved Trips
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem data-testid="menu-item-settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive" data-testid="menu-item-logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
