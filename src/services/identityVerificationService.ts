import axios from "axios";

interface BVNVerificationRequest {
  bvn: string;
  phoneNumber: string;
}

interface NINVerificationRequest {
  nin: string;
}

interface VNINVerificationRequest {
  vnin: string;
}

interface VerificationResponse {
  verified: boolean;
  data?: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    phoneNumber?: string;
    bvn?: string;
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    gender?: string;
    date_of_birth?: string;
    phone_number1?: string;
    phone_number?: string;
    email?: string;
    phone_number2?: string;
    residential_address?: string;
    state_of_origin?: string;
    state_of_residence?: string;
    lga_of_origin?: string;
    lga_of_residence?: string;
    marital_status?: string;
    name_on_card?: string;
    nationality?: string;
    registration_date?: string;
    enrollment_bank?: string;
    enrollment_branch?: string;
    level_of_account?: string;
    watch_listed?: string;
    title?: string;
    image?: string;
  };
  message?: string;
}

// Mono-specific interfaces
interface MonoInitiateResponse {
  sessionId: string;
  methods: Array<{
    method: string;
    hint: string;
  }>;
}

interface MonoVerifyResponse {
  message: string;
  timestamp: string;
}

interface MonoBVNDetails {
  first_name: string;
  last_name: string;
  middle_name?: string;
  dob: string;
  phone_number: string;
  phone_number_2?: string | null;
  email: string;
  gender: string;
  state_of_origin: string;
  bvn: string;
  nin: string;
  registration_date: string;
  lga_of_origin: string;
  lga_of_Residence: string;
  marital_status: string;
  watch_listed: boolean;
  photoId: string;
}

class IdentityVerificationService {
  private apiKey: string;
  private baseUrl: string;
  private provider: string;

  constructor() {
    this.apiKey = process.env.VERIFICATION_API_KEY || "";
    this.baseUrl = process.env.VERIFICATION_API_URL || "";
    this.provider = process.env.VERIFICATION_PROVIDER || "dojah";
  }

  async verifyBVN(
    request: BVNVerificationRequest
  ): Promise<VerificationResponse> {
    try {
      if (process.env.NODE_ENV === "development") {
        return this.mockBVNVerification(request);
      }

      switch (this.provider.toLowerCase()) {
        case "dojah":
          return await this.verifyBVNWithDojah(request);
        case "youverify":
          return await this.verifyBVNWithYouverify(request);
        case "mono":
          return await this.verifyBVNWithMono(request);
        default:
          return await this.verifyBVNWithDojah(request);
      }
    } catch (error) {
      console.error("BVN verification error:", error);
      return {
        verified: false,
        message: "Failed to verify BVN",
      };
    }
  }

  async verifyNIN(
    request: NINVerificationRequest
  ): Promise<VerificationResponse> {
    try {
      if (process.env.NODE_ENV === "development") {
        return this.mockNINVerification(request);
      }

      switch (this.provider.toLowerCase()) {
        case "dojah":
          return await this.verifyNINWithDojah(request);
        case "youverify":
          return await this.verifyNINWithYouverify(request);
        default:
          return await this.verifyNINWithDojah(request);
      }
    } catch (error) {
      console.error("NIN verification error:", error);
      return {
        verified: false,
        message: "Failed to verify NIN",
      };
    }
  }

  async verifyVNIN(
    request: VNINVerificationRequest
  ): Promise<VerificationResponse> {
    try {
      if (process.env.NODE_ENV === "development") {
        return this.mockVNINVerification(request);
      }

      switch (this.provider.toLowerCase()) {
        case "dojah":
          return await this.verifyVNINWithDojah(request);
        default:
          return await this.verifyVNINWithDojah(request);
      }
    } catch (error) {
      console.error("VNIN verification error:", error);
      return {
        verified: false,
        message: "Failed to verify VNIN",
      };
    }
  }

  private async verifyBVNWithDojah(
    request: BVNVerificationRequest
  ): Promise<VerificationResponse> {
    console.log("this is the request", request);
    const response = await axios.get(`${this.baseUrl}/api/v1/kyc/bvn/full`, {
      params: {
        bvn: request.bvn,
      },
      headers: {
        Authorization: process.env.VERIFICATION_API_KEY,
        AppId: process.env.DOJAH_APP_ID,
      },
    });

    console.log("response.data", response.data);

    if (response.data.entity?.bvn) {
      const data = response.data.entity;
      // Check if phone_number1 or phone_number matches
      const phoneMatch =
        data.phone_number1 === request.phoneNumber ||
        data.phone_number === request.phoneNumber ||
        data.phone_number2 === request.phoneNumber;

      return {
        verified: phoneMatch,
        data: {
          firstName: data.first_name,
          lastName: data.last_name,
          dateOfBirth: data.date_of_birth,
          phoneNumber: data.phone_number1 || data.phone_number,
          gender: data.gender,
        },
      };
    }

    return {
      verified: false,
      message: "BVN not found or phone number mismatch",
    };
  }

  private async verifyBVNWithYouverify(
    request: BVNVerificationRequest
  ): Promise<VerificationResponse> {
    const response = await axios.post(
      `${this.baseUrl}/v2/api/identity/ng/bvn`,
      {
        id: request.bvn,
        metadata: {
          phoneNumber: request.phoneNumber,
        },
      },
      {
        headers: {
          Token: this.apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.success && response.data.data) {
      const data = response.data.data;
      return {
        verified: data.phoneNumber === request.phoneNumber,
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          phoneNumber: data.phoneNumber,
          gender: data.gender,
        },
      };
    }

    return { verified: false, message: "BVN verification failed" };
  }

  // Mono BVN Verification - Step 1: Initiate Lookup
  async initiateMonoBVNLookup(
    bvn: string
  ): Promise<{
    success: boolean;
    sessionId?: string;
    methods?: Array<{ method: string; hint: string }>;
    message?: string;
  }> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v2/lookup/bvn/initiate`,
        {
          bvn: bvn,
          scope: "identity",
        },
        {
          headers: {
            "mono-sec-key": this.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "successful" && response.data.data) {
        return {
          success: true,
          sessionId: response.data.data.session_id,
          methods: response.data.data.methods,
        };
      }

      return {
        success: false,
        message: response.data.message || "Failed to initiate BVN lookup",
      };
    } catch (error: any) {
      console.error("Mono BVN initiate error:", error);
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to initiate BVN lookup",
      };
    }
  }

  // Mono BVN Verification - Step 2: Verify OTP Method
  async verifyMonoBVNOTP(
    sessionId: string,
    method: string,
    phoneNumber?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      const body: any = { method };
      if (method === "alternate_phone" && phoneNumber) {
        body.phone_number = phoneNumber;
      }

      const response = await axios.post(
        `${this.baseUrl}/v2/lookup/bvn/verify`,
        body,
        {
          headers: {
            "mono-sec-key": this.apiKey,
            "x-session-id": sessionId,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "successful") {
        return {
          success: true,
          message: response.data.message,
        };
      }

      return {
        success: false,
        message: response.data.message || "Failed to verify OTP method",
      };
    } catch (error: any) {
      console.error("Mono BVN verify OTP error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to verify OTP method",
      };
    }
  }

  // Mono BVN Verification - Step 3: Fetch Details
  async fetchMonoBVNDetails(
    sessionId: string,
    otp: string
  ): Promise<VerificationResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/v2/lookup/bvn/details`,
        {
          otp: otp,
        },
        {
          headers: {
            "mono-sec-key": this.apiKey,
            "x-session-id": sessionId,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status === "successful" && response.data.data) {
        const data: MonoBVNDetails = response.data.data;
        return {
          verified: true,
          data: {
            firstName: data.first_name,
            lastName: data.last_name,
            dateOfBirth: data.dob,
            phoneNumber: data.phone_number,
            gender: data.gender,
          },
        };
      }

      return {
        verified: false,
        message: response.data.message || "Failed to fetch BVN details",
      };
    } catch (error: any) {
      console.error("Mono BVN fetch details error:", error);
      return {
        verified: false,
        message: error.response?.data?.message || "Failed to fetch BVN details",
      };
    }
  }

  // Legacy method - kept for backward compatibility but throws error for Mono
  private async verifyBVNWithMono(
    request: BVNVerificationRequest
  ): Promise<VerificationResponse> {
    throw new Error(
      "Mono BVN verification requires a 3-step process. Please use initiateMonoBVNLookup, verifyMonoBVNOTP, and fetchMonoBVNDetails methods instead."
    );
  }

  private async verifyNINWithDojah(
    request: NINVerificationRequest
  ): Promise<VerificationResponse> {
    const response = await axios.post(
      `${this.baseUrl}/api/v1/kyc/nin`,
      {
        nin: request.nin,
      },
      {
        headers: {
          Authorization: this.apiKey,
          AppId: process.env.DOJAH_APP_ID || "",
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.entity?.nin) {
      const data = response.data.entity;
      return {
        verified: true,
        data: {
          firstName: data.firstname,
          lastName: data.surname,
          dateOfBirth: data.birthdate,
          phoneNumber: data.telephoneno,
          gender: data.gender,
        },
      };
    }

    return { verified: false, message: "NIN not found" };
  }

  private async verifyNINWithYouverify(
    request: NINVerificationRequest
  ): Promise<VerificationResponse> {
    const response = await axios.post(
      `${this.baseUrl}/v2/api/identity/ng/nin`,
      {
        id: request.nin,
      },
      {
        headers: {
          Token: this.apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.success && response.data.data) {
      const data = response.data.data;
      return {
        verified: true,
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth,
          phoneNumber: data.phoneNumber,
          gender: data.gender,
        },
      };
    }

    return { verified: false, message: "NIN verification failed" };
  }

  private mockBVNVerification(
    request: BVNVerificationRequest
  ): VerificationResponse {
    const validBVN = "22440537915";
    const validPhone = "08146414524";

    if (request.bvn === validBVN && request.phoneNumber === validPhone) {
      return {
        verified: true,
        // data: {
        //   firstName: 'Timilehin',
        //   lastName: 'Odusanya',
        //   dateOfBirth: '1994-08-08',
        //   phoneNumber: validPhone,
        //   gender: 'Male',
        // },
        data: {
          bvn: "22171234567",
          first_name: "Timilehin",
          last_name: "Odusanya",
          middle_name: "John",
          gender: "Male",
          date_of_birth: "1994-08-08",
          phone_number1: "08146414524",
          image: "BASE 64 IMAGE",
          email: "timmmycruz36@gmail.com",
          enrollment_bank: "GTB",
          enrollment_branch: "IKEJA",
          level_of_account: "LEVEL 2",
          lga_of_origin: "OSOGBO",
          lga_of_residence: "IKEJA",
          marital_status: "SINGLE",
          name_on_card: "",
          nationality: "NIGERIAN",
          phone_number2: "08012345678",
          registration_date: "",
          residential_address: "",
          state_of_origin: "OSUN",
          state_of_residence: "LAGOS",
          title: "MISS",
          watch_listed: "NO",
        },
      };
    }

    if (request.bvn.length === 11 && request.phoneNumber.length >= 13) {
      return {
        verified: true,
        data: {
          firstName: "Test",
          lastName: "User",
          dateOfBirth: "1995-06-20",
          phoneNumber: request.phoneNumber,
          gender: "Male",
        },
      };
    }

    return {
      verified: false,
      message: "BVN and phone number do not match",
    };
  }

  private mockNINVerification(
    request: NINVerificationRequest
  ): VerificationResponse {
    const validNIN = "12345678901";

    console.log("this is the request", request);

    if (request.nin === validNIN || request.nin.length === 11) {
      return {
        verified: true,
        data: {
          firstName: "Test",
          lastName: "User",
          dateOfBirth: "1992-03-10",
          phoneNumber: "2348012345678",
          gender: "Female",
        },
      };
    }

    return {
      verified: false,
      message: "NIN not found",
    };
  }

  private async verifyVNINWithDojah(
    request: VNINVerificationRequest
  ): Promise<VerificationResponse> {
    const response = await axios.get(`${this.baseUrl}/api/v1/kyc/vnin`, {
      params: {
        vnin: request.vnin,
      },
      headers: {
        Authorization: this.apiKey,
        AppId: process.env.DOJAH_APP_ID || "",
      },
    });

    if (response.data.entity?.vnin) {
      const data = response.data.entity;
      return {
        verified: true,
        data: {
          firstName: data.firstname,
          lastName: data.surname,
          dateOfBirth: data.dateOfBirth,
          phoneNumber: data.mobile,
          gender: data.gender,
        },
      };
    }

    return { verified: false, message: "VNIN not found or invalid" };
  }

  private mockVNINVerification(
    request: VNINVerificationRequest
  ): VerificationResponse {
    const validVNIN = "AB012345678910YZ";

    console.log("this is the VNIN request", request);

    // VNIN format: 2 letters + 12 digits + 2 letters (16 characters total)
    const vninPattern = /^[A-Z]{2}\d{12}[A-Z]{2}$/i;

    if (request.vnin === validVNIN || vninPattern.test(request.vnin)) {
      return {
        verified: true,
        data: {
          firstName: "Test",
          lastName: "User",
          dateOfBirth: "1992-03-10",
          phoneNumber: "2348012345678",
          gender: "Female",
        },
      };
    }

    return {
      verified: false,
      message: "VNIN not found or invalid",
    };
  }
}

export const identityVerificationService = new IdentityVerificationService();
