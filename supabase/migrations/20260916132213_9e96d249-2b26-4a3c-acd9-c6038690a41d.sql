CREATE TABLE public.beginner_session_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.beginner_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_source TEXT NOT NULL DEFAULT 'upload' CHECK (video_source IN ('upload','external')),
  video_path TEXT,
  video_url TEXT,
  thumbnail_path TEXT,
  aspect_ratio TEXT NOT NULL DEFAULT '16:9' CHECK (aspect_ratio IN ('16:9','9:16','1:1','4:3')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.beginner_session_extras TO service_role;
ALTER TABLE public.beginner_session_extras ENABLE ROW LEVEL SECURITY;
CREATE INDEX beginner_session_extras_session_idx ON public.beginner_session_extras (session_id, sort_order);
CREATE TRIGGER beginner_session_extras_set_updated_at BEFORE UPDATE ON public.beginner_session_extras FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','video','file','audio')),
  media_path TEXT,
  media_mime TEXT,
  media_name TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX chat_messages_pair_idx ON public.chat_messages (sender_id, recipient_id, created_at);
CREATE INDEX chat_messages_inbox_idx ON public.chat_messages (recipient_id, read_at);

CREATE TABLE public.chat_preferences (
  user_id UUID NOT NULL PRIMARY KEY,
  show_avatar BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT ALL ON public.chat_preferences TO service_role;
ALTER TABLE public.chat_preferences ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER chat_preferences_set_updated_at BEFORE UPDATE ON public.chat_preferences FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.trainees ADD COLUMN IF NOT EXISTS avatar_path TEXT;