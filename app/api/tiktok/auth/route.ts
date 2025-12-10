import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY || '';
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `https://bifacial-daniele-westerly.ngrok-free.dev/api/tiktok/callback`
  : 'https://bifacial-daniele-westerly.ngrok-free.dev/api/tiktok/callback';

// TikTok OAuth scopes - apenas o básico para começar
const SCOPES = ['user.info.basic'].join(',');

// Função para gerar code_verifier e code_challenge (PKCE)
function generatePKCE() {
  // Gerar code_verifier (string aleatória de 43-128 caracteres)
  const code_verifier = crypto.randomBytes(32).toString('base64url');
  
  // Gerar code_challenge (SHA256 hash do code_verifier)
  const code_challenge = crypto
    .createHash('sha256')
    .update(code_verifier)
    .digest('base64url');
  
  return { code_verifier, code_challenge };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  // Debug: Log das variáveis de ambiente (remover em produção)
  console.log('=== TikTok Auth Debug ===');
  console.log('REDIRECT_URI:', REDIRECT_URI);
  console.log('========================');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  if (!TIKTOK_CLIENT_KEY || TIKTOK_CLIENT_KEY.trim() === '') {
    console.error('❌ TIKTOK_CLIENT_KEY não está configurado!');
    console.error('Verifique seu arquivo .env.local');
    return NextResponse.json({ 
      error: 'TikTok Client Key not configured',
      hint: 'Adicione TIKTOK_CLIENT_KEY ao arquivo .env.local e reinicie o servidor'
    }, { status: 500 });
  }

  // Gerar PKCE
  const { code_verifier, code_challenge } = generatePKCE();

  // Gerar state para CSRF protection
  const state = `${userId}:${Math.random().toString(36).substring(7)}`;

  // Construir URL de autorização do TikTok
  const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
  authUrl.searchParams.append('client_key', TIKTOK_CLIENT_KEY.trim());
  authUrl.searchParams.append('scope', SCOPES);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('code_challenge', code_challenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');

  console.log('✅ OAuth URL gerada:', authUrl.toString());

  // Criar resposta com cookie para armazenar code_verifier
  const response = NextResponse.redirect(authUrl.toString());
  
  // Armazenar code_verifier em cookie (necessário para o callback)
  response.cookies.set('tiktok_code_verifier', code_verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600, // 10 minutos
    sameSite: 'lax',
  });

  return response;
}

