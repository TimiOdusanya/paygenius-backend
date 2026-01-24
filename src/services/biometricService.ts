import axios from 'axios';

interface LivenessResult {
  success: boolean;
  livenessProbability?: number;
  faceDetected?: boolean;
  multiFaceDetected?: boolean;
  raw?: any;
  message?: string;
}

class BiometricService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey =
      process.env.DOJAH_LIVENESS_KEY ||
      process.env.VERIFICATION_API_KEY ||
      '';
    this.baseUrl =
      process.env.DOJAH_LIVENESS_BASE_URL ||
      process.env.VERIFICATION_API_URL ||
      'https://api.dojah.io';
  }

  async checkLiveness(imageBase64: string): Promise<LivenessResult> {
    try {
      if (
        process.env.NODE_ENV === 'development' ||
        !this.apiKey ||
        !this.baseUrl
      ) {
        return {
          success: true,
          livenessProbability: 0.9,
          faceDetected: true,
          multiFaceDetected: false,
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/api/v1/ml/liveness/`,
        { image: imageBase64 },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: this.apiKey,
          },
        }
      );

      const entity = response.data?.entity || {};
      const liveness = entity.liveness;
      const face = entity.face;

      const prob =
        typeof liveness?.liveness_probability === 'number'
          ? liveness.liveness_probability
          : 0;

      const livenessOk = prob >= 0.5;
      const faceDetected = !!face?.face_detected;
      const multiFace = !!face?.multiface_detected;

      return {
        success: livenessOk && faceDetected && !multiFace,
        livenessProbability: prob,
        faceDetected,
        multiFaceDetected: multiFace,
        raw: entity,
        message:
          !faceDetected
            ? 'No face detected'
            : multiFace
            ? 'Multiple faces detected'
            : !livenessOk
            ? 'Liveness check failed'
            : undefined,
      };
    } catch (error: any) {
      console.error(
        'Dojah liveness error:',
        error.response?.data || error.message
      );
      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.response?.data?.error ||
          'Failed to perform liveness check',
      };
    }
  }
}

export const biometricService = new BiometricService();


