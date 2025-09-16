// import axios from "axios";

// const REDIS_GEO_URL = "http://192.168.1.54:5002"; // your Redis GEO microservice

// export const RedisGeoService = {
//   updateLocation: async (captainId: number, lat: number, lng: number) => {
//     try {
//       await axios.post(`${REDIS_GEO_URL}/captains/${captainId}/location`, { lat, lng });
//       console.log("✅ Redis GEO location updated", captainId, lat, lng);
//     } catch (err) {
//       console.error("❌ Redis GEO update failed", err);
//     }
//   },

//   goOffline: async (captainId: number) => {
//     try {
//       await axios.post(`${REDIS_GEO_URL}/captains/${captainId}/offline`);
//       console.log("🛑 Redis GEO marked offline");
//     } catch (err) {
//       console.error("❌ Redis GEO offline failed", err);
//     }
//   },
// };
// lib/redisGeoService.ts
import axios from "axios";

const API_BASE = "http://192.168.1.54:5002"; // your Redis microservice

// Captain profile type
type CaptainProfile = {
  name: string;
  phone_number: string;
  email: string;
  license_number: string;
  current_vehicle?: {
    id: number;
    vehicle_type: string;
    make: string;
    model: string;
    year?: number;
    color: string;
    plate_number: string;
    capacity: number;
  };
};

export const RedisGeoService = {
  // ✅ Send location + captain profile details
  async updateLocation(captainId: number, lat: number, lng: number, captainProfile?: CaptainProfile) {
    try {
      const requestBody = {
        lat,
        lng,
        ...(captainProfile && {
          name: captainProfile.name,
          phone_number: captainProfile.phone_number,
          email: captainProfile.email,
          license_number: captainProfile.license_number,
          ...(captainProfile.current_vehicle && {
            current_vehicle: {
              id: captainProfile.current_vehicle.id,
              vehicle_type: captainProfile.current_vehicle.vehicle_type,
              make: captainProfile.current_vehicle.make,
              model: captainProfile.current_vehicle.model,
              year: captainProfile.current_vehicle.year,
              color: captainProfile.current_vehicle.color,
              plate_number: captainProfile.current_vehicle.plate_number,
              capacity: captainProfile.current_vehicle.capacity,
            }
          })
        })
      };
      
      await axios.post(`${API_BASE}/captains/${captainId}/location`, requestBody);
      console.log("🔍 RedisGeoService - Request body:", JSON.stringify(requestBody, null, 2));
      console.log("✅ Redis updated for captain", captainId, "with profile:", captainProfile ? "✅" : "❌");
      console.log("🚗 Current vehicle:", captainProfile?.current_vehicle ? "✅" : "❌");
      if (captainProfile?.current_vehicle) {
        console.log("🚗 Vehicle details being sent:", {
          id: captainProfile.current_vehicle.id,
          vehicle_type: captainProfile.current_vehicle.vehicle_type,
          make: captainProfile.current_vehicle.make,
          model: captainProfile.current_vehicle.model,
          plate_number: captainProfile.current_vehicle.plate_number
        });
      }
    } catch (err) {
      console.error("❌ Redis update failed", err);
    }
  },

  // ✅ Go offline manually (remove from Redis)
  async goOffline(captainId: number) {
    try {
      await axios.post(`${API_BASE}/captains/${captainId}/offline`
        
      );
      console.log("🚫 Captain offline in Redis");
    } catch (err) {
      console.error("❌ Redis offline failed", err);
    }
  },
};
