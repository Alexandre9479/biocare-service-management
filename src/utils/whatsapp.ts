import supabase from '@/lib/supabase'

export interface WhatsAppSettings {
  phone_number_id: string
  access_token: string
  enabled: boolean
  api_version: string
}

export interface WhatsAppMessage {
  to: string              // E.164 format: +254712345678
  recipientName?: string
  messageType: string
  body: string
}

export interface WhatsAppResult {
  success: boolean
  messageId?: string
  error?: string
}

// ── Fetch WhatsApp settings from Supabase ────────────────────────────────────
export async function getWhatsAppSettings(): Promise<WhatsAppSettings | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value')
    .in('key', ['whatsapp_phone_number_id', 'whatsapp_access_token', 'whatsapp_enabled', 'whatsapp_api_version'])

  if (error || !data?.length) return null

  const map: Record<string, string> = {}
  data.forEach(row => { map[row.key] = row.value ?? '' })

  return {
    phone_number_id: map.whatsapp_phone_number_id ?? '',
    access_token:    map.whatsapp_access_token ?? '',
    enabled:         map.whatsapp_enabled === 'true',
    api_version:     map.whatsapp_api_version ?? 'v21.0',
  }
}

// ── Sanitise phone to E.164 ──────────────────────────────────────────────────
export function normalisePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '')
  // Kenya numbers: 07xx → +2547xx, 01xx → +2541xx
  if (cleaned.startsWith('07') || cleaned.startsWith('01')) {
    cleaned = '+254' + cleaned.slice(1)
  }
  if (cleaned.startsWith('254') && !cleaned.startsWith('+')) {
    cleaned = '+' + cleaned
  }
  return cleaned
}

// ── Send a free-form text message via Meta Cloud API ────────────────────────
// Note: Free-form messages only work within 24-hour customer service window.
// For outbound notifications, use sendTemplate() with approved templates.
export async function sendTextMessage(
  settings: WhatsAppSettings,
  to: string,
  text: string
): Promise<WhatsAppResult> {
  const phone = normalisePhone(to)
  const url = `https://graph.facebook.com/${settings.api_version}/${settings.phone_number_id}/messages`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { body: text, preview_url: false },
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      return { success: false, error: json?.error?.message ?? `HTTP ${res.status}` }
    }

    return { success: true, messageId: json?.messages?.[0]?.id }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Network error' }
  }
}

// ── Send a template message (pre-approved by Meta) ──────────────────────────
// Templates must be created in Meta Business Manager and approved before use.
export async function sendTemplateMessage(
  settings: WhatsAppSettings,
  to: string,
  templateName: string,
  languageCode: string,
  components: object[]
): Promise<WhatsAppResult> {
  const phone = normalisePhone(to)
  const url = `https://graph.facebook.com/${settings.api_version}/${settings.phone_number_id}/messages`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: { name: templateName, language: { code: languageCode }, components },
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      return { success: false, error: json?.error?.message ?? `HTTP ${res.status}` }
    }

    return { success: true, messageId: json?.messages?.[0]?.id }
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Network error' }
  }
}

// ── High-level notification senders ─────────────────────────────────────────

export async function notifyEngineerAssignment(params: {
  engineerPhone: string
  engineerName: string
  facilityName: string
  equipmentModel: string
  serialNumber: string
  scheduledDate: string
  serviceType: string
  instructions?: string
  sentBy?: string
}): Promise<WhatsAppResult> {
  const settings = await getWhatsAppSettings()
  if (!settings?.enabled || !settings.phone_number_id || !settings.access_token) {
    return { success: false, error: 'WhatsApp not configured or disabled' }
  }

  const message = [
    `🔧 *New Service Assignment — Biocare*`,
    ``,
    `Hi ${params.engineerName},`,
    ``,
    `You have been assigned a service job:`,
    `📍 *Facility:* ${params.facilityName}`,
    `🔬 *Equipment:* ${params.equipmentModel} (S/N: ${params.serialNumber})`,
    `📅 *Scheduled:* ${params.scheduledDate}`,
    `🛠 *Type:* ${params.serviceType}`,
    params.instructions ? `\n⚠️ *Notes:* ${params.instructions}` : '',
    ``,
    `Please confirm receipt and plan accordingly.`,
    `— Biocare Health Systems`,
  ].filter(l => l !== undefined).join('\n')

  const result = await sendTextMessage(settings, params.engineerPhone, message)

  // Log the attempt in Supabase
  await supabase.from('whatsapp_log').insert({
    recipient_phone: params.engineerPhone,
    recipient_name:  params.engineerName,
    message_type:    'assignment',
    message_body:    message,
    status:          result.success ? 'sent' : 'failed',
    meta_message_id: result.messageId ?? null,
    error_details:   result.error ?? null,
    sent_by:         params.sentBy ?? null,
  })

  return result
}

export async function notifyServiceReminder(params: {
  facilityPhone: string
  facilityName: string
  equipmentModel: string
  scheduledDate: string
  engineerName: string
  sentBy?: string
}): Promise<WhatsAppResult> {
  const settings = await getWhatsAppSettings()
  if (!settings?.enabled || !settings.phone_number_id || !settings.access_token) {
    return { success: false, error: 'WhatsApp not configured or disabled' }
  }

  const message = [
    `📋 *Service Reminder — Biocare Health Systems*`,
    ``,
    `Dear ${params.facilityName},`,
    ``,
    `This is a reminder that your ${params.equipmentModel} is scheduled for service:`,
    `📅 *Date:* ${params.scheduledDate}`,
    `👷 *Engineer:* ${params.engineerName}`,
    ``,
    `Please ensure the equipment is accessible on the scheduled date.`,
    ``,
    `For any changes, contact us at biocarehealthsystems@gmail.com`,
    `— Biocare Health Systems`,
  ].join('\n')

  const result = await sendTextMessage(settings, params.facilityPhone, message)

  await supabase.from('whatsapp_log').insert({
    recipient_phone: params.facilityPhone,
    recipient_name:  params.facilityName,
    message_type:    'reminder',
    message_body:    message,
    status:          result.success ? 'sent' : 'failed',
    meta_message_id: result.messageId ?? null,
    error_details:   result.error ?? null,
    sent_by:         params.sentBy ?? null,
  })

  return result
}

export async function notifyWarrantyExpiry(params: {
  facilityPhone: string
  facilityName: string
  equipmentModel: string
  serialNumber: string
  warrantyExpiryDate: string
  daysLeft: number
  sentBy?: string
}): Promise<WhatsAppResult> {
  const settings = await getWhatsAppSettings()
  if (!settings?.enabled || !settings.phone_number_id || !settings.access_token) {
    return { success: false, error: 'WhatsApp not configured or disabled' }
  }

  const urgency = params.daysLeft <= 30 ? '🔴' : params.daysLeft <= 60 ? '🟡' : '🟢'

  const message = [
    `${urgency} *Warranty Expiry Notice — Biocare Health Systems*`,
    ``,
    `Dear ${params.facilityName},`,
    ``,
    `Your equipment warranty is expiring soon:`,
    `🔬 *Equipment:* ${params.equipmentModel}`,
    `🔢 *Serial No:* ${params.serialNumber}`,
    `📅 *Warranty Expires:* ${params.warrantyExpiryDate}`,
    `⏳ *Days Remaining:* ${params.daysLeft} days`,
    ``,
    `Please contact us to discuss service contract options.`,
    `📧 biocarehealthsystems@gmail.com`,
    `— Biocare Health Systems`,
  ].join('\n')

  const result = await sendTextMessage(settings, params.facilityPhone, message)

  await supabase.from('whatsapp_log').insert({
    recipient_phone: params.facilityPhone,
    recipient_name:  params.facilityName,
    message_type:    'warranty_alert',
    message_body:    message,
    status:          result.success ? 'sent' : 'failed',
    meta_message_id: result.messageId ?? null,
    error_details:   result.error ?? null,
    sent_by:         params.sentBy ?? null,
  })

  return result
}
