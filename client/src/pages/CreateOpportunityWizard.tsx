import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Camera,
  Video,
  Upload,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Wrench,
  MapPin,
  Calendar,
  DollarSign,
  ClipboardList,
  Truck,
  Anchor,
  FileText,
  Save,
  Send,
} from "lucide-react";

type ToolPolicy = "lend" | "rent" | "rent_with_operator" | "not_available";

type TenantTool = {
  id: string;
  tenant_id: string;
  name: string;
  category: string | null;
  description: string | null;
  policy: ToolPolicy;
  daily_rate: number | null;
  operator_required: boolean | null;
  availability_notes: string | null;
  created_at: string;
  updated_at: string;
};

type UploadResponse = {
  url: string;
  mimetype: string;
  originalname: string;
  size: number;
};

type OpportunityCreateResponse = {
  id: string;
  opportunity_ref: string;
  status: string;
  created_at: string;
};

type WizardStatus = "idle" | "saving" | "publishing" | "error" | "success";

type MediaItem = {
  localId: string;
  kind: "photo" | "video";
  url: string;
  caption?: string;
};

type LocalResource = {
  localId: string;
  name: string;
  contact?: string;
  notes?: string;
};

type SelectedTool = {
  tool_id: string;
  name: string;
  policy: ToolPolicy;
  daily_rate: number | null;
  operator_required: boolean;
  availability_notes: string | null;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function safeNumber(v: string) {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

async function fetchJSON<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { ...(opts?.headers || {}) },
    ...opts,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      msg = body?.error || body?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

async function uploadFile(file: File): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/uploads", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  if (!res.ok) {
    let msg = "Upload failed";
    try {
      const body = await res.json();
      msg = body?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export default function CreateOpportunityWizard() {
  const [step, setStep] = useState<number>(1);

  const [tools, setTools] = useState<TenantTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolsError, setToolsError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [workCategory, setWorkCategory] = useState("");
  const [description, setDescription] = useState("");
  const [scopeOfWork, setScopeOfWork] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [siteLatitude, setSiteLatitude] = useState<string>("");
  const [siteLongitude, setSiteLongitude] = useState<string>("");
  const [estimatedLow, setEstimatedLow] = useState<string>("");
  const [estimatedHigh, setEstimatedHigh] = useState<string>("");
  const [budgetCeiling, setBudgetCeiling] = useState<string>("");
  const [bidDeadline, setBidDeadline] = useState<string>("");
  const [questionsDeadline, setQuestionsDeadline] = useState<string>("");
  const [expectedStartDate, setExpectedStartDate] = useState<string>("");
  const [expectedDurationDays, setExpectedDurationDays] = useState<string>("");
  const [requiredCerts, setRequiredCerts] = useState<string>("");
  const [visibilityScope, setVisibilityScope] = useState<"public" | "portal_only" | "tenant_only" | "invite_only">("public");

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [vehicleAccess, setVehicleAccess] = useState<boolean>(true);
  const [requiresBoat, setRequiresBoat] = useState<boolean>(false);
  const [requiresWaterTaxi, setRequiresWaterTaxi] = useState<boolean>(false);
  const [eastBamfieldDropoff, setEastBamfieldDropoff] = useState<boolean>(false);
  const [walkingDistanceM, setWalkingDistanceM] = useState<string>("");
  const [stairsOrBoardwalk, setStairsOrBoardwalk] = useState<boolean>(false);
  const [accessNotes, setAccessNotes] = useState<string>("");
  const [heavyEquipmentPossible, setHeavyEquipmentPossible] = useState<boolean>(true);
  const [ferryOrLanderRequired, setFerryOrLanderRequired] = useState<boolean>(false);
  const [reservationLeadTimeDays, setReservationLeadTimeDays] = useState<string>("");
  const [transportNotes, setTransportNotes] = useState<string>("");

  const [selectedToolIds, setSelectedToolIds] = useState<Record<string, boolean>>({});
  const [homeownerToolNotes, setHomeownerToolNotes] = useState<string>("");
  const [adhocTools, setAdhocTools] = useState<Array<{ localId: string; name: string; notes?: string }>>([]);

  const [resources, setResources] = useState<LocalResource[]>([
    {
      localId: crypto.randomUUID?.() || `lr_${Date.now()}`,
      name: "Lucky Lander",
      contact: "Brian (text)",
      notes: "Book weeks/months ahead. Often out of cell reception. No published schedule.",
    },
    {
      localId: (crypto.randomUUID?.() || `lr_${Date.now()}`) + "_2",
      name: "John (Excavator)",
      contact: "",
      notes: "Excavator typically only available with operator. Check seasonal calendar (e.g., Italy Nov-Apr).",
    },
  ]);

  const [status, setStatus] = useState<WizardStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [createdOpportunity, setCreatedOpportunity] = useState<OpportunityCreateResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setToolsLoading(true);
      setToolsError(null);
      try {
        const data = await fetchJSON<{ tools: TenantTool[] }>("/api/tools");
        if (!mounted) return;
        setTools(data.tools || []);
      } catch (e: any) {
        if (!mounted) return;
        setToolsError(e?.message || "Failed to load tools");
      } finally {
        if (mounted) setToolsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const selectedToolsSnapshot: SelectedTool[] = useMemo(() => {
    const chosen = tools
      .filter((t) => selectedToolIds[t.id])
      .map((t) => ({
        tool_id: t.id,
        name: t.name,
        policy: t.policy,
        daily_rate: t.daily_rate,
        operator_required: !!t.operator_required,
        availability_notes: t.availability_notes ?? null,
      }));
    for (const ad of adhocTools) {
      if (ad.name.trim()) {
        chosen.push({
          tool_id: `adhoc:${ad.localId}`,
          name: ad.name.trim(),
          policy: "lend",
          daily_rate: null,
          operator_required: false,
          availability_notes: ad.notes || null,
        });
      }
    }
    return chosen;
  }, [tools, selectedToolIds, adhocTools]);

  const logisticsProfile = useMemo(() => ({
    access: {
      vehicle_access: vehicleAccess,
      requires_boat: requiresBoat,
      requires_water_taxi: requiresWaterTaxi,
      east_bamfield_dropoff: eastBamfieldDropoff,
      walking_distance_m: safeNumber(walkingDistanceM),
      stairs_or_boardwalk: stairsOrBoardwalk,
      notes: accessNotes?.trim() || "",
    },
    transport_constraints: {
      heavy_equipment_possible: heavyEquipmentPossible,
      ferry_or_lander_required: ferryOrLanderRequired,
      reservation_lead_time_days: safeNumber(reservationLeadTimeDays),
      contact_notes: transportNotes?.trim() || "",
    },
  }), [vehicleAccess, requiresBoat, requiresWaterTaxi, eastBamfieldDropoff, walkingDistanceM, stairsOrBoardwalk, accessNotes, heavyEquipmentPossible, ferryOrLanderRequired, reservationLeadTimeDays, transportNotes]);

  const availableToolsSnapshot = useMemo(() => ({
    tools: selectedToolsSnapshot,
    homeowner_notes: homeownerToolNotes?.trim() || "",
  }), [selectedToolsSnapshot, homeownerToolNotes]);

  const localResourcesPayload = useMemo(() => ({
    subcontract_options: resources
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        contact: r.contact?.trim() || "",
        notes: r.notes?.trim() || "",
      })),
  }), [resources]);

  function canGoNext() {
    if (step === 1) return title.trim().length > 0 && workCategory.trim().length > 0;
    return true;
  }

  function nextStep() {
    if (!canGoNext()) {
      setStatus("error");
      setStatusMessage("Please complete Title and Category before continuing.");
      return;
    }
    setStatus("idle");
    setStatusMessage(null);
    setStep((s) => Math.min(5, s + 1));
  }

  function prevStep() {
    setStatus("idle");
    setStatusMessage(null);
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleAddFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      const newItems: MediaItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files.item(i);
        if (!file) continue;
        const isVideo = file.type.startsWith("video/");
        const isImage = file.type.startsWith("image/");
        if (!isVideo && !isImage) throw new Error("Unsupported file type. Please upload images or videos.");
        const uploaded = await uploadFile(file);
        newItems.push({
          localId: crypto.randomUUID?.() || `m_${Date.now()}_${i}`,
          kind: isVideo ? "video" : "photo",
          url: uploaded.url,
          caption: "",
        });
      }
      setMedia((m) => [...m, ...newItems]);
    } catch (e: any) {
      setUploadError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function removeMedia(localId: string) {
    setMedia((m) => m.filter((x) => x.localId !== localId));
  }

  function updateMediaCaption(localId: string, caption: string) {
    setMedia((m) => m.map((x) => (x.localId === localId ? { ...x, caption } : x)));
  }

  function toggleTool(toolId: string) {
    setSelectedToolIds((prev) => ({ ...prev, [toolId]: !prev[toolId] }));
  }

  function addAdhocTool() {
    setAdhocTools((prev) => [...prev, { localId: crypto.randomUUID?.() || `at_${Date.now()}`, name: "", notes: "" }]);
  }

  function removeAdhocTool(localId: string) {
    setAdhocTools((prev) => prev.filter((t) => t.localId !== localId));
  }

  function updateAdhocTool(localId: string, patch: Partial<{ name: string; notes: string }>) {
    setAdhocTools((prev) => prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)));
  }

  function addResource() {
    setResources((prev) => [...prev, { localId: crypto.randomUUID?.() || `lr_${Date.now()}`, name: "", contact: "", notes: "" }]);
  }

  function removeResource(localId: string) {
    setResources((prev) => prev.filter((r) => r.localId !== localId));
  }

  function updateResource(localId: string, patch: Partial<Pick<LocalResource, "name" | "contact" | "notes">>) {
    setResources((prev) => prev.map((r) => (r.localId === localId ? { ...r, ...patch } : r)));
  }

  function parseCerts(input: string): string[] | null {
    const arr = input.split(",").map((s) => s.trim()).filter(Boolean);
    return arr.length ? arr : null;
  }

  function buildOpportunityPayload(statusValue: "draft" | "published") {
    return {
      title: title.trim(),
      description: description?.trim() || null,
      scope_of_work: scopeOfWork?.trim() || null,
      work_category: workCategory.trim(),
      site_address: siteAddress?.trim() || null,
      site_latitude: safeNumber(siteLatitude),
      site_longitude: safeNumber(siteLongitude),
      estimated_value_low: safeNumber(estimatedLow),
      estimated_value_high: safeNumber(estimatedHigh),
      budget_ceiling: safeNumber(budgetCeiling),
      bid_deadline: bidDeadline || null,
      questions_deadline: questionsDeadline || null,
      expected_start_date: expectedStartDate || null,
      expected_duration_days: safeNumber(expectedDurationDays),
      required_certifications: parseCerts(requiredCerts),
      visibility_scope: visibilityScope,
      status: statusValue,
      logistics_profile: logisticsProfile,
      available_tools_snapshot: availableToolsSnapshot,
      local_resources: localResourcesPayload,
    };
  }

  async function createOpportunityAndAttachMedia(statusValue: "draft" | "published") {
    setStatus(statusValue === "published" ? "publishing" : "saving");
    setStatusMessage(null);
    setUploadError(null);

    try {
      const payload = buildOpportunityPayload(statusValue);
      const created = await fetchJSON<OpportunityCreateResponse>("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setCreatedOpportunity(created);

      for (const item of media) {
        await fetchJSON<any>(`/api/opportunities/${created.id}/media`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_type: item.kind === "video" ? "video" : "image",
            url: item.url,
            caption: item.caption || null,
          }),
        });
      }

      setStatus("success");
      setStatusMessage(statusValue === "published" ? `Published (${created.opportunity_ref})` : `Saved as draft (${created.opportunity_ref})`);
      return created;
    } catch (e: any) {
      setStatus("error");
      setStatusMessage(e?.message || "Failed to save opportunity");
      return null;
    }
  }

  const computedBudgetText = useMemo(() => {
    const low = safeNumber(estimatedLow);
    const high = safeNumber(estimatedHigh);
    if (low != null && high != null) return `${formatCurrency(low)} - ${formatCurrency(high)}`;
    if (low != null) return `From ${formatCurrency(low)}`;
    if (high != null) return `Up to ${formatCurrency(high)}`;
    return "Not set";
  }, [estimatedLow, estimatedHigh]);

  const stepTitles = ["Basics", "Photos & Videos", "Access & Logistics", "Tools & Equipment", "Local Resources"];

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <Link href="/jobs" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors" data-testid="link-back-jobs">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-400">
              Step <span className="text-white font-semibold">{step}</span> / 5
            </div>
            <div className="h-2 w-48 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${(step / 5) * 100}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="w-5 h-5 text-blue-400" />
              <h1 className="text-xl font-semibold">Post a Job</h1>
            </div>
            <p className="text-slate-400 text-sm">
              Build a bid-ready package. In remote towns, logistics and on-site tools can change the quote massively.
            </p>
          </div>

          {statusMessage && (
            <div className={classNames(
              "rounded-xl border p-4 flex items-start gap-3",
              status === "error" ? "border-red-500/30 bg-red-500/10 text-red-100" :
              status === "success" ? "border-green-500/30 bg-green-500/10 text-green-100" :
              "border-blue-500/30 bg-blue-500/10 text-blue-100"
            )}>
              {status === "error" ? <AlertCircle className="w-5 h-5 mt-0.5" /> :
               status === "success" ? <CheckCircle className="w-5 h-5 mt-0.5" /> :
               <Upload className="w-5 h-5 mt-0.5" />}
              <div className="text-sm" data-testid="text-status-message">{statusMessage}</div>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-lg font-semibold">{stepTitles[step - 1]}</h2>
              <div className="hidden md:flex items-center gap-2 text-xs">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStep(s)}
                    data-testid={`button-step-${s}`}
                    className={classNames(
                      "px-2 py-1 rounded-md border transition-colors",
                      step === s ? "border-blue-500/50 bg-blue-500/20 text-blue-100" : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-300">Title <span className="text-red-400">*</span></label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Septic System Installation"
                      data-testid="input-title"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">Category <span className="text-red-400">*</span></label>
                    <input value={workCategory} onChange={(e) => setWorkCategory(e.target.value)} placeholder="e.g., Plumbing"
                      data-testid="input-category"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-300 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-400" />Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What do you want done?"
                    data-testid="input-description"
                    className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div>
                  <label className="text-sm text-slate-300">Scope of Work</label>
                  <textarea value={scopeOfWork} onChange={(e) => setScopeOfWork(e.target.value)} rows={4} placeholder="1) ... 2) ... 3) ..."
                    data-testid="input-scope"
                    className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-300 flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-400" />Site Address</label>
                    <input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="321 Forest Road, Hagensborg, BC"
                      data-testid="input-site-address"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">Visibility</label>
                    <select value={visibilityScope} onChange={(e) => setVisibilityScope(e.target.value as any)}
                      data-testid="select-visibility"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="public">Public</option>
                      <option value="portal_only">Portal Only</option>
                      <option value="tenant_only">Tenant Only</option>
                      <option value="invite_only">Invite Only</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm text-slate-300 flex items-center gap-2"><DollarSign className="w-4 h-4 text-blue-400" />Est. Low</label>
                    <input type="number" value={estimatedLow} onChange={(e) => setEstimatedLow(e.target.value)} placeholder="22000"
                      data-testid="input-est-low"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">Est. High</label>
                    <input type="number" value={estimatedHigh} onChange={(e) => setEstimatedHigh(e.target.value)} placeholder="32000"
                      data-testid="input-est-high"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">Budget Ceiling</label>
                    <input type="number" value={budgetCeiling} onChange={(e) => setBudgetCeiling(e.target.value)} placeholder="35000"
                      data-testid="input-budget-ceiling"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm text-slate-300 flex items-center gap-2"><Calendar className="w-4 h-4 text-blue-400" />Bid Deadline</label>
                    <input type="date" value={bidDeadline} onChange={(e) => setBidDeadline(e.target.value)}
                      data-testid="input-bid-deadline"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">Questions Deadline</label>
                    <input type="date" value={questionsDeadline} onChange={(e) => setQuestionsDeadline(e.target.value)}
                      data-testid="input-questions-deadline"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">Expected Start</label>
                    <input type="date" value={expectedStartDate} onChange={(e) => setExpectedStartDate(e.target.value)}
                      data-testid="input-expected-start"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">Duration (days)</label>
                    <input type="number" value={expectedDurationDays} onChange={(e) => setExpectedDurationDays(e.target.value)} placeholder="10"
                      data-testid="input-duration"
                      className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-300">Required Certifications (comma-separated)</label>
                  <input value={requiredCerts} onChange={(e) => setRequiredCerts(e.target.value)} placeholder="Certified Plumber, Septic Installer"
                    data-testid="input-certifications"
                    className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-200 mb-2">
                    <Video className="w-4 h-4 text-blue-400" />Video Guidance
                  </div>
                  <ul className="text-sm text-slate-400 space-y-1 list-disc ml-5">
                    <li>Keep each video under ~60 seconds</li>
                    <li>Narrate what you want done while filming</li>
                    <li>Show access points: driveway, gates, docks, stairs</li>
                  </ul>
                </div>

                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <div className="text-sm text-slate-300 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-blue-400" />Upload photos and short videos
                  </div>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer text-white">
                    <Upload className="w-4 h-4" />{uploading ? "Uploading..." : "Add Files"}
                    <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={(e) => handleAddFiles(e.target.files)} disabled={uploading} data-testid="input-file-upload" />
                  </label>
                </div>

                {uploadError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100" data-testid="text-upload-error">{uploadError}</div>}

                {media.length === 0 ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 text-center text-slate-400">
                    No media yet. Add at least a few photos for best bids.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {media.map((m) => (
                      <div key={m.localId} className="rounded-lg border border-slate-700 bg-slate-800/50 overflow-hidden" data-testid={`media-item-${m.localId}`}>
                        <div className="p-3 flex items-center justify-between gap-2 border-b border-slate-700">
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            {m.kind === "photo" ? <Camera className="w-4 h-4 text-blue-400" /> : <Video className="w-4 h-4 text-purple-400" />}
                            <span className="uppercase">{m.kind}</span>
                          </div>
                          <button onClick={() => removeMedia(m.localId)} className="text-slate-400 hover:text-red-400 transition-colors" data-testid={`button-remove-media-${m.localId}`}><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <div className="p-3">
                          {m.kind === "photo" ? (
                            <img src={m.url} alt="Uploaded" className="w-full h-44 object-cover rounded-lg border border-slate-700" />
                          ) : (
                            <video src={m.url} controls className="w-full h-44 object-cover rounded-lg border border-slate-700" />
                          )}
                          <label className="text-xs text-slate-400 mt-3 block">Caption</label>
                          <input value={m.caption || ""} onChange={(e) => updateMediaCaption(m.localId, e.target.value)} placeholder="e.g., Access path from dock"
                            data-testid={`input-caption-${m.localId}`}
                            className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-200 mb-2">
                    <Truck className="w-4 h-4 text-blue-400" />Why this matters
                  </div>
                  <p className="text-sm text-slate-400">
                    In remote towns, mobilization can dominate cost. Capturing access constraints prevents bad bids.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-200"><MapPin className="w-4 h-4 text-blue-400" />Access</div>
                    <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                      Vehicle access<input type="checkbox" checked={vehicleAccess} onChange={(e) => setVehicleAccess(e.target.checked)} className="h-4 w-4 accent-blue-600" data-testid="checkbox-vehicle-access" />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                      Requires boat<input type="checkbox" checked={requiresBoat} onChange={(e) => setRequiresBoat(e.target.checked)} className="h-4 w-4 accent-blue-600" data-testid="checkbox-requires-boat" />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                      Requires water taxi<input type="checkbox" checked={requiresWaterTaxi} onChange={(e) => setRequiresWaterTaxi(e.target.checked)} className="h-4 w-4 accent-blue-600" data-testid="checkbox-water-taxi" />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                      East Bamfield drop-off<input type="checkbox" checked={eastBamfieldDropoff} onChange={(e) => setEastBamfieldDropoff(e.target.checked)} className="h-4 w-4 accent-blue-600" data-testid="checkbox-east-bamfield" />
                    </label>
                    <div>
                      <label className="text-xs text-slate-400">Walking distance (meters)</label>
                      <input type="number" value={walkingDistanceM} onChange={(e) => setWalkingDistanceM(e.target.value)} placeholder="250"
                        data-testid="input-walking-distance"
                        className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-300">
                      <input type="checkbox" checked={stairsOrBoardwalk} onChange={(e) => setStairsOrBoardwalk(e.target.checked)} className="h-4 w-4 accent-blue-600" data-testid="checkbox-stairs" />
                      Stairs / boardwalk
                    </label>
                    <div>
                      <label className="text-xs text-slate-400">Access notes</label>
                      <textarea value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} rows={3} placeholder="e.g., narrow stairs, no truck turn-around..."
                        data-testid="input-access-notes"
                        className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm text-slate-200"><Anchor className="w-4 h-4 text-blue-400" />Equipment Transport</div>
                    <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                      Heavy equipment possible<input type="checkbox" checked={heavyEquipmentPossible} onChange={(e) => setHeavyEquipmentPossible(e.target.checked)} className="h-4 w-4 accent-blue-600" data-testid="checkbox-heavy-equipment" />
                    </label>
                    <label className="flex items-center justify-between gap-3 text-sm text-slate-300">
                      Ferry/Lander required<input type="checkbox" checked={ferryOrLanderRequired} onChange={(e) => setFerryOrLanderRequired(e.target.checked)} className="h-4 w-4 accent-blue-600" data-testid="checkbox-ferry-lander" />
                    </label>
                    <div>
                      <label className="text-xs text-slate-400">Reservation lead-time (days)</label>
                      <input type="number" value={reservationLeadTimeDays} onChange={(e) => setReservationLeadTimeDays(e.target.value)} placeholder="14"
                        data-testid="input-reservation-lead-time"
                        className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Transport notes</label>
                      <textarea value={transportNotes} onChange={(e) => setTransportNotes(e.target.value)} rows={4} placeholder="e.g., Lucky Lander must be reserved weeks ahead..."
                        data-testid="input-transport-notes"
                        className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-200 mb-2"><Wrench className="w-4 h-4 text-blue-400" />On-site Tools</div>
                  <p className="text-sm text-slate-400">Select tools your site can provide. Reduces contractor mobilization cost.</p>
                </div>

                {toolsLoading ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5 text-slate-400">Loading tools...</div>
                ) : toolsError ? (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-5 text-red-100" data-testid="text-tools-error">{toolsError}</div>
                ) : tools.length === 0 ? (
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-5 text-slate-400">
                    No tools in inventory yet. Add ad-hoc tools below or create tools in your tenant settings.
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-3">
                    {tools.map((t) => {
                      const selected = !!selectedToolIds[t.id];
                      const policyLabel = t.policy === "lend" ? "Lend" : t.policy === "rent" ? "Rent" : t.policy === "rent_with_operator" ? "Rent + Operator" : "N/A";
                      return (
                        <button key={t.id} type="button" onClick={() => toggleTool(t.id)}
                          data-testid={`button-tool-${t.id}`}
                          className={classNames("text-left rounded-lg border p-4 transition-colors", selected ? "border-blue-500/50 bg-blue-500/10" : "border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-slate-600")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-slate-100 truncate">{t.name}</div>
                              <div className="text-xs text-slate-400 mt-0.5">{t.category || "Uncategorized"} - {policyLabel}{t.daily_rate != null ? ` - ${formatCurrency(Number(t.daily_rate))}/day` : ""}</div>
                            </div>
                            <div className={classNames("mt-1 h-5 w-5 rounded border flex items-center justify-center flex-shrink-0", selected ? "border-blue-400 bg-blue-600/30" : "border-slate-600")}>
                              {selected && <CheckCircle className="w-4 h-4 text-blue-200" />}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div>
                  <label className="text-sm text-slate-300">Notes about tools</label>
                  <textarea value={homeownerToolNotes} onChange={(e) => setHomeownerToolNotes(e.target.value)} rows={3} placeholder="e.g., Full shop available. Some items rent-only."
                    data-testid="input-tool-notes"
                    className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>

                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-slate-200 font-medium">Ad-hoc Tools</div>
                      <div className="text-xs text-slate-500 mt-1">Tools not in inventory yet</div>
                    </div>
                    <button type="button" onClick={addAdhocTool} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100" data-testid="button-add-adhoc-tool">
                      <Plus className="w-4 h-4" />Add
                    </button>
                  </div>
                  {adhocTools.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {adhocTools.map((t) => (
                        <div key={t.localId} className="rounded-lg border border-slate-700 bg-slate-900/50 p-3 flex items-center gap-3" data-testid={`adhoc-tool-${t.localId}`}>
                          <div className="flex-1 grid md:grid-cols-2 gap-3">
                            <input value={t.name} onChange={(e) => updateAdhocTool(t.localId, { name: e.target.value })} placeholder="Tool name"
                              data-testid={`input-adhoc-name-${t.localId}`}
                              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <input value={t.notes || ""} onChange={(e) => updateAdhocTool(t.localId, { notes: e.target.value })} placeholder="Notes"
                              data-testid={`input-adhoc-notes-${t.localId}`}
                              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <button onClick={() => removeAdhocTool(t.localId)} className="text-slate-400 hover:text-red-400" data-testid={`button-remove-adhoc-${t.localId}`}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                  <div className="flex items-center gap-2 text-sm text-slate-200 mb-2"><Wrench className="w-4 h-4 text-blue-400" />Local Resources</div>
                  <p className="text-sm text-slate-400">Add local contacts that make the job possible (equipment transport, operators, specialists).</p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-300">Subcontract options / key contacts</div>
                  <button type="button" onClick={addResource} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-100" data-testid="button-add-resource">
                    <Plus className="w-4 h-4" />Add
                  </button>
                </div>

                <div className="space-y-3">
                  {resources.map((r) => (
                    <div key={r.localId} className="rounded-lg border border-slate-700 bg-slate-800/50 p-4" data-testid={`resource-${r.localId}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 grid md:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-slate-400">Name</label>
                            <input value={r.name} onChange={(e) => updateResource(r.localId, { name: e.target.value })} placeholder="e.g., Lucky Lander"
                              data-testid={`input-resource-name-${r.localId}`}
                              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs text-slate-400">Contact</label>
                            <input value={r.contact || ""} onChange={(e) => updateResource(r.localId, { contact: e.target.value })} placeholder="e.g., Brian (text)"
                              data-testid={`input-resource-contact-${r.localId}`}
                              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-xs text-slate-400">Notes</label>
                            <textarea value={r.notes || ""} onChange={(e) => updateResource(r.localId, { notes: e.target.value })} rows={2} placeholder="e.g., Book weeks ahead; seasonal availability..."
                              data-testid={`input-resource-notes-${r.localId}`}
                              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        </div>
                        <button onClick={() => removeResource(r.localId)} className="text-slate-400 hover:text-red-400" data-testid={`button-remove-resource-${r.localId}`}><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <button onClick={prevStep} disabled={step === 1}
              data-testid="button-prev-step"
              className={classNames("px-4 py-2 rounded-lg border transition-colors", step === 1 ? "border-slate-800 text-slate-600 cursor-not-allowed" : "border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-100")}>
              Back
            </button>
            <button onClick={nextStep} disabled={step === 5}
              data-testid="button-next-step"
              className={classNames("px-4 py-2 rounded-lg border transition-colors", step === 5 ? "border-slate-800 text-slate-600 cursor-not-allowed" : "border-blue-500/50 bg-blue-600 hover:bg-blue-700 text-white")}>
              Next
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 sticky top-24">
            <div className="text-sm text-slate-400 mb-4">Summary</div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Title</span><span className="text-slate-200 text-right truncate max-w-[150px]" data-testid="text-summary-title">{title || "-"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Category</span><span className="text-slate-200" data-testid="text-summary-category">{workCategory || "-"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Budget</span><span className="text-slate-200" data-testid="text-summary-budget">{computedBudgetText}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Deadline</span><span className="text-slate-200" data-testid="text-summary-deadline">{bidDeadline || "-"}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Media</span><span className="text-slate-200" data-testid="text-summary-media">{media.length} files</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tools</span><span className="text-slate-200" data-testid="text-summary-tools">{selectedToolsSnapshot.length} items</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Resources</span><span className="text-slate-200" data-testid="text-summary-resources">{resources.filter(r => r.name.trim()).length} contacts</span></div>
            </div>

            <div className="border-t border-slate-800 mt-5 pt-5 space-y-3">
              <button onClick={() => createOpportunityAndAttachMedia("draft")} disabled={status === "saving" || status === "publishing" || uploading}
                data-testid="button-save-draft"
                className="w-full px-4 py-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-100 flex items-center justify-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" />{status === "saving" ? "Saving..." : "Save Draft"}
              </button>
              <button onClick={() => createOpportunityAndAttachMedia("published")} disabled={status === "saving" || status === "publishing" || uploading || !title.trim() || !workCategory.trim()}
                data-testid="button-publish"
                className="w-full px-4 py-3 rounded-lg border border-blue-500/40 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 disabled:opacity-50">
                <Send className="w-4 h-4" />{status === "publishing" ? "Publishing..." : "Publish"}
              </button>

              {createdOpportunity && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-sm" data-testid="card-created-opportunity">
                  <div className="text-slate-300 font-medium">Created!</div>
                  <div className="text-slate-400 mt-1">Ref: <span className="font-mono text-slate-200" data-testid="text-created-ref">{createdOpportunity.opportunity_ref}</span></div>
                  <div className="text-slate-400">Status: <span className="text-slate-200" data-testid="text-created-status">{createdOpportunity.status}</span></div>
                  <Link href={`/opportunities/${createdOpportunity.id}`} className="text-blue-400 hover:text-blue-300 underline text-sm mt-2 inline-block" data-testid="link-view-opportunity">
                    View Opportunity
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
