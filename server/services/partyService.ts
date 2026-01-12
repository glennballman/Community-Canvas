import { db, pool } from '../db';
import { eq, and, asc, desc } from 'drizzle-orm';
import { ccTripPartyProfiles, ccDietaryLookup, ccTrips } from '@shared/schema';

interface CreateProfileRequest {
  tripId: string;
  displayName: string;
  role?: 'primary' | 'co_planner' | 'adult' | 'child' | 'infant' | 'guest';
  ageGroup?: 'adult' | 'teen' | 'child' | 'infant';
  birthDate?: Date;
  email?: string;
  phone?: string;
  invitationId?: string;
  dietaryRestrictions?: string[];
  dietaryPreferences?: string[];
  dietarySeverity?: 'life_threatening' | 'allergy' | 'intolerance' | 'preference';
  dietaryNotes?: string;
  accessibility?: Record<string, any>;
  medical?: Record<string, any>;
  needs?: Record<string, any>;
  preferences?: Record<string, any>;
  surprises?: Record<string, any>;
}

interface AggregatedNeeds {
  dietary: {
    lifeThreateningAllergies: string[];
    allergies: string[];
    intolerances: string[];
    preferences: string[];
    notes: string[];
  };
  accessibility: {
    wheelchairRequired: boolean;
    limitedMobility: boolean;
    stairsOk: boolean;
    serviceAnimals: any[];
    other: string[];
  };
  medical: {
    powerCritical: any[];
    conditions: string[];
    emergencyContacts: any[];
  };
  partyComposition: {
    adults: number;
    teens: number;
    children: number;
    infants: number;
    total: number;
  };
  pets: any[];
  lowestSwimmingAbility: string;
  lowestPhysicalFitness: string;
  languages: string[];
}

export async function createProfile(req: CreateProfileRequest): Promise<any> {
  const [profile] = await db.insert(ccTripPartyProfiles).values({
    tripId: req.tripId,
    displayName: req.displayName,
    role: req.role || 'guest',
    ageGroup: req.ageGroup,
    birthDate: req.birthDate ? req.birthDate.toISOString().split('T')[0] : undefined,
    email: req.email,
    phone: req.phone,
    invitationId: req.invitationId,
    dietaryRestrictions: req.dietaryRestrictions,
    dietaryPreferences: req.dietaryPreferences,
    dietarySeverity: req.dietarySeverity || 'preference',
    dietaryNotes: req.dietaryNotes,
    accessibilityJson: req.accessibility || {},
    medicalJson: req.medical || {},
    needsJson: req.needs || {},
    preferencesJson: req.preferences || {},
    surprisesJson: req.surprises || {}
  }).returning();
  
  await updateTripAggregatedNeeds(req.tripId);
  
  return profile;
}

export async function getProfile(profileId: string): Promise<any | null> {
  const results = await db.select()
    .from(ccTripPartyProfiles)
    .where(eq(ccTripPartyProfiles.id, profileId))
    .limit(1);
  return results[0] || null;
}

export async function getTripProfiles(tripId: string): Promise<any[]> {
  return db.select()
    .from(ccTripPartyProfiles)
    .where(and(
      eq(ccTripPartyProfiles.tripId, tripId),
      eq(ccTripPartyProfiles.isActive, true)
    ))
    .orderBy(asc(ccTripPartyProfiles.displayName));
}

export async function updateProfile(
  profileId: string,
  updates: Partial<CreateProfileRequest>
): Promise<any> {
  const existing = await getProfile(profileId);
  if (!existing) throw new Error('Profile not found');
  
  const setData: any = { updatedAt: new Date() };
  
  if (updates.displayName !== undefined) setData.displayName = updates.displayName;
  if (updates.role !== undefined) setData.role = updates.role;
  if (updates.ageGroup !== undefined) setData.ageGroup = updates.ageGroup;
  if (updates.birthDate !== undefined) setData.birthDate = updates.birthDate.toISOString().split('T')[0];
  if (updates.email !== undefined) setData.email = updates.email;
  if (updates.phone !== undefined) setData.phone = updates.phone;
  if (updates.dietaryRestrictions !== undefined) setData.dietaryRestrictions = updates.dietaryRestrictions;
  if (updates.dietaryPreferences !== undefined) setData.dietaryPreferences = updates.dietaryPreferences;
  if (updates.dietarySeverity !== undefined) setData.dietarySeverity = updates.dietarySeverity;
  if (updates.dietaryNotes !== undefined) setData.dietaryNotes = updates.dietaryNotes;
  if (updates.accessibility !== undefined) setData.accessibilityJson = updates.accessibility;
  if (updates.medical !== undefined) setData.medicalJson = updates.medical;
  if (updates.needs !== undefined) setData.needsJson = updates.needs;
  if (updates.preferences !== undefined) setData.preferencesJson = updates.preferences;
  if (updates.surprises !== undefined) setData.surprisesJson = updates.surprises;
  
  const [updated] = await db.update(ccTripPartyProfiles)
    .set(setData)
    .where(eq(ccTripPartyProfiles.id, profileId))
    .returning();
  
  await updateTripAggregatedNeeds(existing.tripId);
  
  return updated;
}

export async function deleteProfile(profileId: string): Promise<void> {
  const existing = await getProfile(profileId);
  if (!existing) return;
  
  await db.update(ccTripPartyProfiles)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(ccTripPartyProfiles.id, profileId));
  
  await updateTripAggregatedNeeds(existing.tripId);
}

export async function aggregateNeeds(tripId: string): Promise<AggregatedNeeds> {
  const profiles = await getTripProfiles(tripId);
  
  const result: AggregatedNeeds = {
    dietary: {
      lifeThreateningAllergies: [],
      allergies: [],
      intolerances: [],
      preferences: [],
      notes: []
    },
    accessibility: {
      wheelchairRequired: false,
      limitedMobility: false,
      stairsOk: true,
      serviceAnimals: [],
      other: []
    },
    medical: {
      powerCritical: [],
      conditions: [],
      emergencyContacts: []
    },
    partyComposition: {
      adults: 0,
      teens: 0,
      children: 0,
      infants: 0,
      total: 0
    },
    pets: [],
    lowestSwimmingAbility: 'strong',
    lowestPhysicalFitness: 'athletic',
    languages: []
  };
  
  const swimmingLevels = ['none', 'beginner', 'comfortable', 'strong'];
  const fitnessLevels = ['limited', 'moderate', 'active', 'athletic'];
  
  for (const profile of profiles) {
    switch (profile.ageGroup) {
      case 'adult': result.partyComposition.adults++; break;
      case 'teen': result.partyComposition.teens++; break;
      case 'child': result.partyComposition.children++; break;
      case 'infant': result.partyComposition.infants++; break;
      default: result.partyComposition.adults++;
    }
    result.partyComposition.total++;
    
    if (profile.dietaryRestrictions?.length) {
      if (profile.dietarySeverity === 'life_threatening') {
        result.dietary.lifeThreateningAllergies.push(...profile.dietaryRestrictions);
      } else if (profile.dietarySeverity === 'allergy') {
        result.dietary.allergies.push(...profile.dietaryRestrictions);
      } else if (profile.dietarySeverity === 'intolerance') {
        result.dietary.intolerances.push(...profile.dietaryRestrictions);
      }
    }
    if (profile.dietaryPreferences?.length) {
      result.dietary.preferences.push(...profile.dietaryPreferences);
    }
    if (profile.dietaryNotes) {
      result.dietary.notes.push(`${profile.displayName}: ${profile.dietaryNotes}`);
    }
    
    const access = profile.accessibilityJson || {};
    if (access.wheelchair) result.accessibility.wheelchairRequired = true;
    if (access.limitedMobility) result.accessibility.limitedMobility = true;
    if (access.stairsOk === false) result.accessibility.stairsOk = false;
    if (access.serviceAnimal) {
      result.accessibility.serviceAnimals.push({
        ...access.serviceAnimal,
        belongsTo: profile.displayName
      });
    }
    
    const medical = profile.medicalJson || {};
    if (medical.powerCritical?.length) {
      result.medical.powerCritical.push(...medical.powerCritical.map((p: any) => ({
        ...p,
        belongsTo: profile.displayName
      })));
    }
    if (medical.conditions?.length) {
      result.medical.conditions.push(...medical.conditions);
    }
    if (medical.emergencyContact) {
      result.medical.emergencyContacts.push({
        ...medical.emergencyContact,
        forPerson: profile.displayName
      });
    }
    
    const needs = profile.needsJson || {};
    if (needs.pets?.length) {
      result.pets.push(...needs.pets.map((p: any) => ({
        ...p,
        belongsTo: profile.displayName
      })));
    }
    if (needs.languages?.length) {
      result.languages.push(...needs.languages);
    }
    
    if (needs.swimmingAbility) {
      const level = swimmingLevels.indexOf(needs.swimmingAbility);
      const current = swimmingLevels.indexOf(result.lowestSwimmingAbility);
      if (level >= 0 && level < current) result.lowestSwimmingAbility = needs.swimmingAbility;
    }
    if (needs.physicalFitness) {
      const level = fitnessLevels.indexOf(needs.physicalFitness);
      const current = fitnessLevels.indexOf(result.lowestPhysicalFitness);
      if (level >= 0 && level < current) result.lowestPhysicalFitness = needs.physicalFitness;
    }
  }
  
  result.dietary.lifeThreateningAllergies = Array.from(new Set(result.dietary.lifeThreateningAllergies));
  result.dietary.allergies = Array.from(new Set(result.dietary.allergies));
  result.dietary.intolerances = Array.from(new Set(result.dietary.intolerances));
  result.dietary.preferences = Array.from(new Set(result.dietary.preferences));
  result.medical.conditions = Array.from(new Set(result.medical.conditions));
  result.languages = Array.from(new Set(result.languages));
  
  return result;
}

async function updateTripAggregatedNeeds(tripId: string): Promise<void> {
  const aggregated = await aggregateNeeds(tripId);
  
  await db.update(ccTrips)
    .set({
      needsJson: aggregated,
      expectedAdults: aggregated.partyComposition.adults,
      expectedChildren: aggregated.partyComposition.children + aggregated.partyComposition.teens,
      expectedInfants: aggregated.partyComposition.infants,
      updatedAt: new Date()
    })
    .where(eq(ccTrips.id, tripId));
}

export async function getDietaryTerms(): Promise<any[]> {
  return db.select()
    .from(ccDietaryLookup)
    .orderBy(asc(ccDietaryLookup.displayOrder));
}
