import { Router, type IRouter } from "express";
import cookieParser from "cookie-parser";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db, sakanWorkspaces, sakanEnquiries, type SakanEnquiryRow } from "@workspace/db";
import {
  GetSakanCatalogResponse, GetSakanWorkspaceResponse, SaveSakanWorkspaceBody,
  SaveSakanWorkspaceResponse, CalculateSakanMatchesBody, CalculateSakanMatchesResponse,
  CreateSakanEnquiryBody, CreateSakanEnquiryResponse,
} from "@workspace/api-zod";
import { calculateMatches, listings, places } from "../lib/sakan-engine";
import { validateBrief, validateDestinations, validateDraft } from "../lib/sakan-validation";

const router: IRouter = Router();
const cookieName = "sakan_workspace";
const limited = new Map<string,{ count: number; until: number }>();
const enquiryOutput = (row: SakanEnquiryRow) => ({
  id: row.id,listingId: row.listingId,name: row.name,contact: row.contact,
  message: row.message,status: row.status,createdAt: row.createdAt.toISOString(),
});
router.use("/sakan", cookieParser(), (req,res,next) => {
  res.setHeader("Cache-Control","private, no-store");
  if (req.get("sec-fetch-site") === "cross-site") {res.status(403).json({error:"Cross-site requests are not permitted."});return;}
  const now = Date.now();
  if (limited.size > 10000) for (const [key,value] of limited) if (value.until < now) limited.delete(key);
  const key = req.ip ?? "unknown";
  const bucket = limited.get(key);
  if (!bucket || bucket.until < now) limited.set(key,{count:1,until:now+60000});
  else if (++bucket.count > 240) {res.status(429).json({error:"Too many requests. Please try again shortly."});return;}
  next();
});
router.get("/sakan/catalog", (_req,res) => {
  res.json(GetSakanCatalogResponse.parse({listings,places,sample:true}));
});
router.post("/sakan/matches", (req,res) => {
  const input = CalculateSakanMatchesBody.safeParse(req.body);
  if (!input.success) {res.status(400).json({error:"Invalid match request."});return;}
  try {
    const brief = validateBrief(input.data.brief);
    const destinations = validateDestinations(input.data.destinations);
    res.json(CalculateSakanMatchesResponse.parse({
      matches:calculateMatches(input.data.goal,brief,destinations,input.data.hidden,input.data.priority),
      calculatedAt:new Date().toISOString(),sample:true,
    }));
  } catch (err) {
    res.status(400).json({error:err instanceof Error ? err.message : "Invalid preferences."});
  }
});
// Anonymous workspace, not a login system. The opaque browser cookie is never
// returned in JSON, logged, or accepted as a user-supplied database identifier.
router.use("/sakan", (req,res,next) => {
  const supplied = req.cookies?.[cookieName] as unknown;
  const token = typeof supplied === "string" && /^[a-f0-9]{64}$/.test(supplied) ? supplied : randomBytes(32).toString("hex");
  res.locals.workspaceId = createHash("sha256").update(token).digest("hex");
  if (token !== supplied) res.cookie(cookieName,token,{
    httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"lax",
    maxAge:30*24*60*60*1000,path:"/api/sakan",
  });
  next();
});
router.get("/sakan/workspace", async (_req,res): Promise<void> => {
  const id = res.locals.workspaceId as string;
  const [workspace] = await db.insert(sakanWorkspaces).values({id}).onConflictDoUpdate({
    target:sakanWorkspaces.id,set:{updatedAt:new Date()},
  }).returning();
  const enquiries = await db.select().from(sakanEnquiries).where(eq(sakanEnquiries.workspaceId,id)).orderBy(desc(sakanEnquiries.createdAt)).limit(100);
  res.json(GetSakanWorkspaceResponse.parse({...workspace,enquiries:enquiries.map(enquiryOutput)}));
});
router.put("/sakan/workspace", async (req,res): Promise<void> => {
  const input = SaveSakanWorkspaceBody.safeParse(req.body);
  if (!input.success) {res.status(400).json({error:"Invalid workspace."});return;}
  let draft: Record<string,unknown>;
  try { draft=validateDraft(input.data.draft); }
  catch(err) {res.status(400).json({error:err instanceof Error ? err.message : "Invalid brief."});return;}
  const ids = new Set(listings.map(l=>l.id));
  if ([...input.data.saved,...input.data.compare].some(id=>!ids.has(id))) {res.status(400).json({error:"Unknown property."});return;}
  const id=res.locals.workspaceId as string;
  const values={draft,saved:[...new Set(input.data.saved)],compare:[...new Set(input.data.compare)],updatedAt:new Date()};
  const [workspace]=await db.insert(sakanWorkspaces).values({id,...values}).onConflictDoUpdate({target:sakanWorkspaces.id,set:values}).returning();
  const enquiries=await db.select().from(sakanEnquiries).where(eq(sakanEnquiries.workspaceId,id)).orderBy(desc(sakanEnquiries.createdAt)).limit(100);
  res.json(SaveSakanWorkspaceResponse.parse({...workspace,enquiries:enquiries.map(enquiryOutput)}));
});
router.delete("/sakan/workspace", async (_req,res): Promise<void> => {
  await db.delete(sakanWorkspaces).where(eq(sakanWorkspaces.id,res.locals.workspaceId as string));
  res.clearCookie(cookieName,{path:"/api/sakan",httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production"});
  res.sendStatus(204);
});
router.post("/sakan/enquiries", async (req,res): Promise<void> => {
  const input=CreateSakanEnquiryBody.safeParse(req.body);
  if (!input.success || !input.data.consent) {res.status(400).json({error:"Add contact details, a message, and your explicit consent."});return;}
  const {name,contact,message,listingId,requestId}=input.data;
  if (!name.trim() || !message.trim() || !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim()) || /^\+?[\d ()-]{7,25}$/.test(contact.trim()))) {
    res.status(400).json({error:"Enter a name, valid email or phone, and message."});return;
  }
  if (!listings.some(l=>l.id===listingId)) {res.status(404).json({error:"Property not found."});return;}
  const workspaceId=res.locals.workspaceId as string;
  await db.insert(sakanWorkspaces).values({id:workspaceId}).onConflictDoNothing();
  const [existing]=await db.select().from(sakanEnquiries).where(and(eq(sakanEnquiries.id,requestId),eq(sakanEnquiries.workspaceId,workspaceId)));
  if (existing) {res.status(201).json(CreateSakanEnquiryResponse.parse(enquiryOutput(existing)));return;}
  const recent=await db.select({id:sakanEnquiries.id}).from(sakanEnquiries).where(eq(sakanEnquiries.workspaceId,workspaceId)).limit(100);
  if (recent.length >= 100) {res.status(429).json({error:"Enquiry limit reached. Clear your workspace to remove stored requests."});return;}
  const [row]=await db.insert(sakanEnquiries).values({
    id:requestId || randomUUID(),workspaceId,listingId,name:name.trim(),contact:contact.trim(),message:message.trim(),
  }).onConflictDoNothing().returning();
  if (!row) {res.status(409).json({error:"Request identifier already used. Start a new enquiry."});return;}
  res.status(201).json(CreateSakanEnquiryResponse.parse(enquiryOutput(row)));
});
export default router;
