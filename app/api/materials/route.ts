import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { canManageAccounts, getAuthContext } from "@/lib/auth";
import { writeOperationLog } from "@/lib/audit";
import { compactId } from "@/lib/ids";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { categoryFromLabel, categoryLabels } from "@/lib/warehouse-maps";

type MaterialRow = {
  id: string;
  materialCode: string;
  name: string;
  category: keyof typeof categoryLabels;
  unit: string;
  minStock: string | number;
  qrCode: string | null;
  defaultPhoto: string | null;
  notes: string | null;
  createdAt: string;
};

type SpecRow = {
  id: string;
  materialId: string;
  specCode: string;
  specModel: string | null;
  materialText: string | null;
  dimensionsText: string | null;
  qrCode: string | null;
};

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const [{ data: materials, error: materialError }, { data: specs, error: specError }] = await Promise.all([
    supabase.from("Material").select("*").order("createdAt", { ascending: false }),
    supabase.from("MaterialSpec").select("*")
  ]);

  if (materialError) return NextResponse.json({ error: materialError.message }, { status: 500 });
  if (specError) return NextResponse.json({ error: specError.message }, { status: 500 });

  const materialRows = (materials ?? []) as MaterialRow[];
  const specRows = (specs ?? []) as SpecRow[];
  const specsByMaterial = new Map<string, SpecRow[]>();
  for (const spec of specRows) {
    specsByMaterial.set(spec.materialId, [...(specsByMaterial.get(spec.materialId) ?? []), spec]);
  }

  return NextResponse.json({
    materials: materialRows.flatMap((material) => {
      const materialSpecs = specsByMaterial.get(material.id) ?? [];
      if (materialSpecs.length === 0) {
        return [{
          id: material.id,
          specId: "",
          code: material.materialCode,
          specCode: "",
          name: material.name,
          category: material.category,
          categoryText: categoryLabels[material.category],
          spec: "",
          material: "",
          dimensions: "",
          unit: material.unit,
          minStock: Number(material.minStock ?? 0),
          qrCode: material.qrCode
        }];
      }
      return materialSpecs.map((spec) => ({
        id: material.id,
        specId: spec.id,
        code: material.materialCode,
        specCode: spec.specCode,
        name: material.name,
        category: material.category,
        categoryText: categoryLabels[material.category],
        spec: spec.specModel ?? "",
        material: spec.materialText ?? "",
        dimensions: spec.dimensionsText ?? "",
        unit: material.unit,
        minStock: Number(material.minStock ?? 0),
        qrCode: spec.qrCode ?? material.qrCode
      }));
    })
  });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });

  const body = (await request.json()) as {
    name?: string;
    category?: string;
    spec?: string;
    material?: string;
    dimensions?: string;
    unit?: string;
    minStock?: number;
    reason?: string;
  };

  if (!body.name || !body.category || !body.unit) {
    return NextResponse.json({ error: "材料名称、分类、单位必填。" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const materialCode = `MAT-${Date.now()}`;
  const specCode = `SPEC-${Date.now()}`;
  const qrText = `${materialCode}|${specCode}`;
  const qrCode = await QRCode.toDataURL(qrText, { margin: 1, width: 180 });

  const { data: material, error: materialError } = await supabase
    .from("Material")
    .insert({
      id: compactId("mat"),
      materialCode,
      name: body.name,
      category: categoryFromLabel(body.category),
      unit: body.unit,
      minStock: body.minStock ?? 0,
      qrCode,
      createdAt: now,
      updatedAt: now
    })
    .select("*")
    .single();

  if (materialError) return NextResponse.json({ error: materialError.message }, { status: 500 });

  const { data: spec, error: specError } = await supabase
    .from("MaterialSpec")
    .insert({
      id: compactId("spec"),
      materialId: material.id,
      specCode,
      specModel: body.spec || null,
      materialText: body.material || null,
      dimensionsText: body.dimensions || null,
      qrCode,
      createdAt: now,
      updatedAt: now
    })
    .select("*")
    .single();

  if (specError) return NextResponse.json({ error: specError.message }, { status: 500 });

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "UPDATE",
    materialId: material.id,
    remark: "新增材料档案",
    before: null,
    after: { material, spec },
    extra: { action: "CREATE_MATERIAL" }
  });

  return NextResponse.json({ message: "材料档案已创建。", material, spec });
}

export async function PATCH(request: NextRequest) {
  const auth = await getAuthContext(request);
  if (!auth) return NextResponse.json({ error: "未登录或账号已禁用。" }, { status: 401 });
  if (!canManageAccounts(auth.profile.role)) {
    return NextResponse.json({ error: "只有老板/管理员可以修改材料档案。" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: string;
    specId?: string;
    name?: string;
    category?: string;
    spec?: string;
    material?: string;
    dimensions?: string;
    unit?: string;
    minStock?: number;
    reason?: string;
  };

  if (!body.id || !body.reason?.trim()) {
    return NextResponse.json({ error: "修改材料必须提供材料 ID 和修改原因。" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: beforeMaterial }, { data: beforeSpec }] = await Promise.all([
    supabase.from("Material").select("*").eq("id", body.id).maybeSingle(),
    body.specId ? supabase.from("MaterialSpec").select("*").eq("id", body.specId).maybeSingle() : Promise.resolve({ data: null })
  ]);

  const now = new Date().toISOString();
  const { data: afterMaterial, error: materialError } = await supabase
    .from("Material")
    .update({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.category !== undefined ? { category: categoryFromLabel(body.category) } : {}),
      ...(body.unit !== undefined ? { unit: body.unit } : {}),
      ...(body.minStock !== undefined ? { minStock: body.minStock } : {}),
      updatedAt: now
    })
    .eq("id", body.id)
    .select("*")
    .single();

  if (materialError) return NextResponse.json({ error: materialError.message }, { status: 500 });

  let afterSpec = null;
  if (body.specId) {
    const { data, error } = await supabase
      .from("MaterialSpec")
      .update({
        ...(body.spec !== undefined ? { specModel: body.spec } : {}),
        ...(body.material !== undefined ? { materialText: body.material } : {}),
        ...(body.dimensions !== undefined ? { dimensionsText: body.dimensions } : {}),
        updatedAt: now
      })
      .eq("id", body.specId)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    afterSpec = data;
  }

  await writeOperationLog({
    actorId: auth.profile.id,
    action: "UPDATE",
    materialId: body.id,
    remark: `管理员修改材料档案：${body.reason}`,
    before: { material: beforeMaterial, spec: beforeSpec },
    after: { material: afterMaterial, spec: afterSpec },
    extra: { action: "UPDATE_MATERIAL" }
  });

  return NextResponse.json({ message: "材料档案已修改。", material: afterMaterial, spec: afterSpec });
}
