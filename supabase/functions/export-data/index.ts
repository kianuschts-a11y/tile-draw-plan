import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const type = url.searchParams.get('type') || 'categories'

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const companyId = '83ccf558-e5ad-4b01-8125-23fb4e92c64e'

  let result: any

  if (type === 'components') {
    const { data } = await supabase.from('components').select('*').eq('company_id', companyId).order('name')
    result = (data || []).map((c: any) => ({
      id: c.id, name: c.name, shapes: c.shapes, width: c.width, height: c.height,
      tileSize: c.tile_size, category: c.category || '', variations: c.variations || [],
      labelingEnabled: c.labeling_enabled || false, labelingPriority: c.labeling_priority || 1,
      labelingColor: c.labeling_color || '#000000', autoConnectionsEnabled: c.auto_connections_enabled || false,
    }))
  } else if (type === 'groups') {
    const { data } = await supabase.from('component_groups').select('*').eq('company_id', companyId).order('created_at')
    result = (data || []).map((g: any) => ({
      id: g.id, name: g.name, componentIds: g.component_ids || [],
      layoutData: g.layout_data || undefined, category: g.category || undefined, tags: g.tags || undefined,
    }))
  } else if (type === 'categories') {
    const { data } = await supabase.from('group_categories').select('*').eq('company_id', companyId).order('sort_order')
    result = (data || []).map((c: any) => ({
      id: c.id, name: c.name, tags: c.tags || [], sortOrder: c.sort_order || 0,
    }))
  } else if (type === 'plans') {
    const { data } = await supabase.from('saved_plans').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    result = (data || []).map((p: any) => ({
      id: p.id, name: p.name, componentQuantities: p.component_quantities || [],
      drawingData: p.drawing_data || { tiles: [], connections: [] },
      matchedGroupId: p.matched_group_id || undefined,
    }))
  }

  // Output as TypeScript file content
  const typeName = type === 'components' ? 'Component' : type === 'groups' ? 'ComponentGroup' : type === 'categories' ? 'GroupCategory' : 'SavedPlanData'
  const importPath = type === 'plans' ? '@/hooks/useSavedPlans' : '@/types/schematic'
  const varName = type === 'components' ? 'DEFAULT_COMPONENTS' : type === 'groups' ? 'DEFAULT_GROUPS' : type === 'categories' ? 'DEFAULT_CATEGORIES' : 'DEFAULT_SAVED_PLANS'
  
  const tsContent = `// Auto-generated from database export\nimport { ${typeName} } from "${importPath}";\n\nexport const ${varName}: ${typeName}[] = ${JSON.stringify(result)};\n`

  return new Response(tsContent, {
    headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
  })
})
