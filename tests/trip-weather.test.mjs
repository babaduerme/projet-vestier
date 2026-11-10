import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchWeatherForDateRange,
  geocodeCity,
} from "../public/js/weather.js";

test("geocodeCity transforme la réponse Open-Meteo en lieu utilisable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      results: [
        {
          name: "Lisbonne",
          admin1: "Lisbonne",
          country: "Portugal",
          latitude: 38.7167,
          longitude: -9.1333,
        },
      ],
    }),
  });
  try {
    const location = await geocodeCity("Lisbonne");
    assert.equal(location.name, "Lisbonne, Lisbonne, Portugal");
    assert.equal(location.country, "Portugal");
    assert.equal(location.coordinates.latitude, 38.7167);
    assert.equal(location.coordinates.longitude, -9.1333);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchWeatherForDateRange filtre les jours hors séjour", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      daily: {
        time: ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"],
        temperature_2m_min: [4, 5, 6, 7],
        temperature_2m_max: [10, 11, 12, 13],
        precipitation_probability_max: [10, 20, 30, 40],
        wind_speed_10m_max: [12, 13, 14, 15],
        weather_code: [0, 2, 61, 3],
      },
    }),
  });
  try {
    const days = await fetchWeatherForDateRange(
      { latitude: 38.7, longitude: -9.1 },
      "2026-11-11",
      "2026-11-12",
    );
    assert.equal(days.length, 2);
    assert.deepEqual(days.map((day) => day.date), ["2026-11-11", "2026-11-12"]);
    assert.equal(days[0].min, 5);
    assert.equal(days[1].max, 12);
    assert.equal(days[1].rain, 30);
    assert.ok(days[1].label);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
