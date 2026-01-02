import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    User, Award, Car, Building2, Settings, Plus, Shield, 
    MapPin, Phone, Briefcase, Calendar, ChevronRight,
    Truck, AlertCircle, CheckCircle2
} from 'lucide-react';

interface Profile {
    id: string;
    user_id: string;
    date_of_birth: string;
    gender: string;
    bio: string;
    address_line1: string;
    address_line2: string;
    city: string;
    province: string;
    postal_code: string;
    country: string;
    emergency_contact_name: string;
    emergency_contact_phone: string;
    emergency_contact_relationship: string;
    sleeping_preferences: {
        snores?: boolean;
        cpap?: boolean;
        needs_private_room?: boolean;
        early_riser?: boolean;
    };
    dietary_restrictions: string[];
    occupation: string;
    employer: string;
}

interface Qualification {
    id: string;
    qualification_type: string;
    name: string;
    category: string;
    issuing_authority: string;
    credential_number: string;
    issued_date: string;
    expiry_date: string;
    is_verified: boolean;
}

interface Vehicle {
    id: string;
    name: string;
    year: number;
    make: string;
    model: string;
    license_plate: string;
    vehicle_type: string;
    status: string;
}

interface Trailer {
    id: string;
    name: string;
    year: number;
    make: string;
    model: string;
    trailer_type: string;
    length_ft: number;
    status: string;
}

export default function MyProfile() {
    const { user, ccTenants, token, loading: authLoading } = useAuth();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [qualifications, setQualifications] = useState<Qualification[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [trailers, setTrailers] = useState<Trailer[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);

    useEffect(() => {
        if (token && user) {
            loadProfileData();
        }
    }, [token, user]);

    async function loadProfileData() {
        setLoading(true);
        try {
            const userRes = await fetch(`/api/foundation/users/${user?.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = await userRes.json();
            
            if (userData.success) {
                setProfile(userData.profile);
                setQualifications(userData.qualifications || []);
            }

            const vehiclesRes = await fetch('/api/vehicles/my', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const vehiclesData = await vehiclesRes.json();
            if (vehiclesData.success) {
                setVehicles(vehiclesData.vehicles || []);
            }

            const trailersRes = await fetch('/api/vehicles/trailers/my', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const trailersData = await trailersRes.json();
            if (trailersData.success) {
                setTrailers(trailersData.trailers || []);
            }

        } catch (err) {
            console.error('Failed to load profile:', err);
        } finally {
            setLoading(false);
        }
    }

    const tenantTypeVariants: Record<string, "default" | "secondary" | "outline"> = {
        platform: 'default',
        government: 'secondary',
        business: 'default',
        property: 'outline',
        individual: 'outline',
    };

    if (authLoading) {
        return (
            <div className="p-6 flex items-center justify-center">
                <div className="text-muted-foreground">Initializing...</div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-start gap-6">
                            <Skeleton className="w-24 h-24 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-8 w-48" />
                                <Skeleton className="h-4 w-64" />
                                <div className="flex gap-4 mt-4">
                                    <Skeleton className="h-16 w-20" />
                                    <Skeleton className="h-16 w-20" />
                                    <Skeleton className="h-16 w-20" />
                                    <Skeleton className="h-16 w-20" />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <Card>
                <CardContent className="p-6">
                    <div className="flex flex-wrap items-start gap-6">
                        <Avatar className="w-24 h-24">
                            <AvatarFallback className="bg-primary text-primary-foreground text-3xl">
                                {(user?.firstName?.[0] || user?.email?.[0] || '?').toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-2xl font-bold">
                                {user?.firstName} {user?.lastName}
                            </h1>
                            <p className="text-muted-foreground">{user?.email}</p>
                            {user?.isPlatformAdmin && (
                                <Badge variant="secondary" className="mt-2">
                                    <Shield className="w-3 h-3 mr-1" />
                                    Platform Administrator
                                </Badge>
                            )}
                            <div className="flex flex-wrap gap-4 mt-4">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-primary">{ccTenants.length}</div>
                                    <div className="text-xs text-muted-foreground">Organizations</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-500">{qualifications.length}</div>
                                    <div className="text-xs text-muted-foreground">Qualifications</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-yellow-500">{vehicles.length}</div>
                                    <div className="text-xs text-muted-foreground">Vehicles</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-orange-500">{trailers.length}</div>
                                    <div className="text-xs text-muted-foreground">Trailers</div>
                                </div>
                            </div>
                        </div>
                        <Button 
                            onClick={() => setEditing(!editing)}
                            data-testid="button-edit-profile"
                        >
                            {editing ? 'Cancel' : 'Edit Profile'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="overview" data-testid="tab-overview">
                        <User className="w-4 h-4 mr-2" />
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="qualifications" data-testid="tab-qualifications">
                        <Award className="w-4 h-4 mr-2" />
                        Qualifications
                    </TabsTrigger>
                    <TabsTrigger value="vehicles" data-testid="tab-vehicles">
                        <Car className="w-4 h-4 mr-2" />
                        Vehicles
                    </TabsTrigger>
                    <TabsTrigger value="organizations" data-testid="tab-organizations">
                        <Building2 className="w-4 h-4 mr-2" />
                        Organizations
                    </TabsTrigger>
                    <TabsTrigger value="preferences" data-testid="tab-preferences">
                        <Settings className="w-4 h-4 mr-2" />
                        Preferences
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview">
                    <Card>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        Personal Information
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-muted-foreground text-sm">Full Name</label>
                                            <p>{user?.firstName} {user?.lastName}</p>
                                        </div>
                                        <div>
                                            <label className="text-muted-foreground text-sm">Email</label>
                                            <p>{user?.email}</p>
                                        </div>
                                        {profile?.occupation && (
                                            <div>
                                                <label className="text-muted-foreground text-sm">Occupation</label>
                                                <p>{profile.occupation}</p>
                                            </div>
                                        )}
                                        {profile?.employer && (
                                            <div>
                                                <label className="text-muted-foreground text-sm">Employer</label>
                                                <p>{profile.employer}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <MapPin className="w-5 h-5" />
                                        Location
                                    </h3>
                                    {profile?.city ? (
                                        <div className="space-y-3">
                                            {profile.address_line1 && (
                                                <div>
                                                    <label className="text-muted-foreground text-sm">Address</label>
                                                    <p>
                                                        {profile.address_line1}
                                                        {profile.address_line2 && <><br />{profile.address_line2}</>}
                                                    </p>
                                                </div>
                                            )}
                                            <div>
                                                <label className="text-muted-foreground text-sm">City</label>
                                                <p>{profile.city}, {profile.province} {profile.postal_code}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground">No location set</p>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Phone className="w-5 h-5" />
                                        Emergency Contact
                                    </h3>
                                    {profile?.emergency_contact_name ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-muted-foreground text-sm">Name</label>
                                                <p>{profile.emergency_contact_name}</p>
                                            </div>
                                            <div>
                                                <label className="text-muted-foreground text-sm">Phone</label>
                                                <p>{profile.emergency_contact_phone}</p>
                                            </div>
                                            <div>
                                                <label className="text-muted-foreground text-sm">Relationship</label>
                                                <p>{profile.emergency_contact_relationship}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground">No emergency contact set</p>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <Briefcase className="w-5 h-5" />
                                        Bio
                                    </h3>
                                    <p className="text-muted-foreground">{profile?.bio || 'No bio set'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="qualifications">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-4">
                            <CardTitle>Qualifications & Certifications</CardTitle>
                            <Button size="sm" data-testid="button-add-qualification">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Qualification
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {qualifications.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8">No qualifications added yet</p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {qualifications.map(q => (
                                        <Card key={q.id} className="bg-muted/50">
                                            <CardContent className="p-4">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h4 className="font-medium">{q.name}</h4>
                                                        <p className="text-muted-foreground text-sm">{q.issuing_authority || q.category}</p>
                                                    </div>
                                                    <Badge variant={
                                                        q.qualification_type === 'license' ? 'default' :
                                                        q.qualification_type === 'certification' ? 'secondary' :
                                                        'outline'
                                                    }>
                                                        {q.qualification_type}
                                                    </Badge>
                                                </div>
                                                <div className="mt-2 flex items-center gap-4 text-sm">
                                                    {q.expiry_date && (
                                                        <span className={`flex items-center gap-1 ${
                                                            new Date(q.expiry_date) < new Date() 
                                                                ? 'text-destructive' 
                                                                : 'text-muted-foreground'
                                                        }`}>
                                                            <Calendar className="w-3 h-3" />
                                                            Expires: {new Date(q.expiry_date).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                    {q.is_verified && (
                                                        <span className="text-green-500 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Verified
                                                        </span>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="vehicles">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-4">
                                <CardTitle className="flex items-center gap-2">
                                    <Car className="w-5 h-5" />
                                    My Vehicles ({vehicles.length})
                                </CardTitle>
                                <Button size="sm" data-testid="button-add-vehicle">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Vehicle
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {vehicles.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-4">No vehicles registered</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {vehicles.map(v => (
                                            <Card key={v.id} className="bg-muted/50">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <Car className="w-8 h-8 text-muted-foreground" />
                                                        <div>
                                                            <h4 className="font-medium">{v.name || `${v.make} ${v.model}`}</h4>
                                                            <p className="text-muted-foreground text-sm">{v.year} {v.make} {v.model}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-muted-foreground">{v.license_plate || 'No plate'}</span>
                                                        <Badge variant={
                                                            v.status === 'available' ? 'default' :
                                                            v.status === 'in_use' ? 'secondary' :
                                                            'outline'
                                                        }>
                                                            {v.status}
                                                        </Badge>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between gap-4">
                                <CardTitle className="flex items-center gap-2">
                                    <Truck className="w-5 h-5" />
                                    My Trailers ({trailers.length})
                                </CardTitle>
                                <Button size="sm" data-testid="button-add-trailer">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Trailer
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {trailers.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-4">No trailers registered</p>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {trailers.map(t => (
                                            <Card key={t.id} className="bg-muted/50">
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <Truck className="w-8 h-8 text-muted-foreground" />
                                                        <div>
                                                            <h4 className="font-medium">{t.name || `${t.make} ${t.model}`}</h4>
                                                            <p className="text-muted-foreground text-sm">
                                                                {t.trailer_type} - {t.length_ft}ft
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-muted-foreground">{t.year} {t.make}</span>
                                                        <Badge variant={t.status === 'available' ? 'default' : 'outline'}>
                                                            {t.status}
                                                        </Badge>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="organizations">
                    <Card>
                        <CardHeader>
                            <CardTitle>My Organizations</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {ccTenants.length === 0 ? (
                                    <p className="text-muted-foreground text-center py-4">No organizations</p>
                                ) : (
                                    ccTenants.map(t => (
                                        <div key={t.id} className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <Badge variant={tenantTypeVariants[t.type] || 'outline'}>
                                                    {t.type}
                                                </Badge>
                                                <div>
                                                    <h4 className="font-medium">{t.name}</h4>
                                                    <p className="text-muted-foreground text-sm">Role: {t.role}</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" data-testid={`link-tenant-${t.id}`}>
                                                View
                                                <ChevronRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="preferences">
                    <Card>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Sleeping Preferences</h3>
                                    <p className="text-muted-foreground text-sm">
                                        Used for accommodation matching when traveling with crews
                                    </p>
                                    <div className="space-y-3">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox 
                                                id="snores"
                                                checked={profile?.sleeping_preferences?.snores || false}
                                                disabled={!editing}
                                            />
                                            <label htmlFor="snores" className="text-sm">I snore</label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox 
                                                id="cpap"
                                                checked={profile?.sleeping_preferences?.cpap || false}
                                                disabled={!editing}
                                            />
                                            <label htmlFor="cpap" className="text-sm">I use a CPAP machine</label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox 
                                                id="private"
                                                checked={profile?.sleeping_preferences?.needs_private_room || false}
                                                disabled={!editing}
                                            />
                                            <label htmlFor="private" className="text-sm">I need a private room</label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox 
                                                id="early"
                                                checked={profile?.sleeping_preferences?.early_riser || false}
                                                disabled={!editing}
                                            />
                                            <label htmlFor="early" className="text-sm">I'm an early riser (before 6am)</label>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">Dietary Restrictions</h3>
                                    <p className="text-muted-foreground text-sm">
                                        Used for meal planning on group trips
                                    </p>
                                    {profile?.dietary_restrictions && profile.dietary_restrictions.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {profile.dietary_restrictions.map((d, i) => (
                                                <Badge key={i} variant="outline">{d}</Badge>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground">No dietary restrictions set</p>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
