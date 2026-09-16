import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const CHAT_BUCKET = "chat-media";

export type ChatIdentity =
  | {
      kind: "trainee";
      id: string;
      name: string;
      code: string;
      avatarPath: string | null;
      uplineId: string | null;
      status: string;
    }
  | {
      kind: "member";
      id: string;
      name: string;
      code: string;
      avatarPath: string | null;
      status: string;
    };

/** Who is the signed-in person? Chat is only ever trainee <-> their own upline. */
export async function resolveChatIdentity(userId: string): Promise<ChatIdentity | null> {
  const { data: trainee } = await supabaseAdmin
    .from("trainees")
    .select("id, full_name, trainee_code, avatar_path, upline_id, status")
    .eq("id", userId)
    .maybeSingle();

  if (trainee) {
    return {
      kind: "trainee",
      id: trainee.id as string,
      name: trainee.full_name as string,
      code: trainee.trainee_code as string,
      avatarPath: ((trainee as any).avatar_path ?? null) as string | null,
      uplineId: (trainee.upline_id ?? null) as string | null,
      status: trainee.status as string,
    };
  }

  const { data: member } = await supabaseAdmin
    .from("member_profiles")
    .select("id, full_name, member_id, avatar_path, status")
    .eq("id", userId)
    .maybeSingle();
  if (!member) return null;

  return {
    kind: "member",
    id: member.id as string,
    name: member.full_name as string,
    code: member.member_id as string,
    avatarPath: (member.avatar_path ?? null) as string | null,
    status: member.status as string,
  };
}

export type ChatPeer = {
  id: string;
  name: string;
  code: string;
  kind: "trainee" | "member";
  avatarPath: string | null;
  status: string;
};

/** The only people this account may message. */
export async function listChatPeers(identity: ChatIdentity): Promise<ChatPeer[]> {
  if (identity.kind === "trainee") {
    if (!identity.uplineId) return [];
    const { data } = await supabaseAdmin
      .from("member_profiles")
      .select("id, full_name, member_id, avatar_path, status")
      .eq("id", identity.uplineId)
      .maybeSingle();
    if (!data || data.status !== "active") return [];
    return [
      {
        id: data.id as string,
        name: data.full_name as string,
        code: data.member_id as string,
        kind: "member",
        avatarPath: (data.avatar_path ?? null) as string | null,
        status: data.status as string,
      },
    ];
  }

  const { data } = await supabaseAdmin
    .from("trainees")
    .select("id, full_name, trainee_code, avatar_path, status")
    .eq("upline_id", identity.id)
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .limit(300);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.full_name as string,
    code: row.trainee_code as string,
    kind: "trainee" as const,
    avatarPath: ((row as any).avatar_path ?? null) as string | null,
    status: row.status as string,
  }));
}

export async function assertPeerAllowed(identity: ChatIdentity, peerId: string): Promise<ChatPeer> {
  const peers = await listChatPeers(identity);
  const peer = peers.find((entry) => entry.id === peerId);
  if (!peer) throw new Error("You can only chat with your own upline or trainees.");
  return peer;
}

/** Does this person want their picture visible in chat? */
export async function chatShowsAvatar(userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("chat_preferences")
    .select("show_avatar")
    .eq("user_id", userId)
    .maybeSingle();
  return data ? Boolean(data.show_avatar) : true;
}
