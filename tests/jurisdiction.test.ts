import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveJurisdiction } from "../src/lib/geo/kharghar-jurisdiction";

describe("Kharghar Municipal Ward & Police Jurisdiction Resolution Suite", () => {
  it("resolves ITM Skills University (Sector 4) to Ward Prabhag 1 and Kharghar Police Station", () => {
    const jur = resolveJurisdiction(19.0338, 73.0630, "Near ITM Gate");
    assert.match(jur.sector, /Sector 4|Institutional/i);
    assert.match(jur.wardCode, /Prabhag 1/i);
    assert.equal(jur.policeStation, "Kharghar Police Station");
    assert.equal(jur.policeEmergency, "112");
    assert.equal(jur.policePhone, "022-27740100");
    assert.match(jur.beatChowki, /Beat Chowki No\. 1/i);
  });

  it("resolves Central Park (Sector 23/24) to Ward Prabhag 3", () => {
    const jur = resolveJurisdiction(19.0450, 73.0690, "Central Park Gate 2");
    assert.match(jur.sector, /Central Park|23/i);
    assert.match(jur.wardCode, /Prabhag 3/i);
    assert.equal(jur.policeStation, "Kharghar Police Station");
    assert.match(jur.beatChowki, /Beat Chowki No\. 3/i);
  });

  it("resolves Valley Shilp (Sector 35) to Ward Prabhag 4", () => {
    const jur = resolveJurisdiction(19.0740, 73.0720, "Valley Shilp Road");
    assert.match(jur.sector, /Sector 35|Valley Shilp/i);
    assert.match(jur.wardCode, /Prabhag 4/i);
    assert.equal(jur.policeStation, "Kharghar Police Station");
    assert.match(jur.beatChowki, /Beat Chowki No\. 4/i);
  });

  it("resolves Shilp Chowk (Sector 20) to Ward Prabhag 2", () => {
    const jur = resolveJurisdiction(19.0490, 73.0650, "Near Shilp Chowk market");
    assert.match(jur.wardCode, /Prabhag 2/i);
    assert.equal(jur.policeStation, "Kharghar Police Station");
    assert.equal(jur.policeEmergency, "112");
  });

  it("provides complete police contact details and municipal ward office helpdesk", () => {
    const jur = resolveJurisdiction(19.0435, 73.0680);
    assert.ok(jur.wardOffice.includes("Panvel Municipal Corporation"));
    assert.ok(jur.wardContact.length > 0);
    assert.ok(jur.policeAddress.includes("Sector 7"));
    assert.equal(jur.policeEmergency, "112");
  });
});
