import { ImageResponse } from '@vercel/og';
import { getAccountInfo } from '@/lib/solana';

export const runtime = 'edge';
export const alt = 'Program Details';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  try {
    const resolvedParams = await params;
    const program = await getAccountInfo(resolvedParams.address);
    
    const title = 'Program Overview';
    const description = program?.executable 
      ? 'Solana Program Account'
      : 'Account not found or not a program';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            backgroundImage: 'linear-gradient(45deg, #000 0%, #111 100%)',
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                width: '80px',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00ffbd 0%, #00b386 100%)',
                marginRight: '16px',
              }}
            >
              <div
                style={{
                  color: 'white',
                  fontSize: '40px',
                  fontWeight: 700,
                }}
              >
                S
              </div>
            </div>
            <div
              style={{
                fontSize: '48px',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #00ffbd 0%, #00b386 100%)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              OPENSVM
            </div>
          </div>

          {/* Content */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: '20px',
              padding: '0 48px',
            }}
          >
            <div
              style={{
                fontSize: '32px',
                fontWeight: 600,
                color: 'white',
                marginBottom: '10px',
                textAlign: 'center',
              }}
            >
              {title}
            </div>
            {program?.executable && (
              <div
                style={{
                  fontSize: '24px',
                  color: '#00ffbd',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                Executable Program
              </div>
            )}
            <div
              style={{
                fontSize: '20px',
                color: '#888',
                textAlign: 'center',
                maxWidth: '600px',
              }}
            >
              {description}
            </div>
            {program && (
              <div
                style={{
                  fontSize: '16px',
                  color: '#666',
                  marginTop: '20px',
                  textAlign: 'center',
                }}
              >
                {resolvedParams.address.slice(0, 20)}...{resolvedParams.address.slice(-20)}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              position: 'absolute',
              bottom: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: '16px',
                color: '#666',
              }}
            >
              opensvm.com
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      },
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
