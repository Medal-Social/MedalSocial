import { describe, expect, it, vi } from "vitest";
import { Medal } from "../src";

const BASE = "https://test.convex.site";

function mockJson(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "content-type": "application/json" },
  });
}

describe("bookings generic model (SP11)", () => {
  it("persons.list sends contact_id and persons.create posts the body", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/v1/bookings/persons?contact_id=c1")) {
        return mockJson({
          data: [
            {
              person_id: "p1",
              contact_id: "c1",
              name: "Nora",
              birth_year: 2020,
              relation_type: "guardian",
              relation_label: null,
              notes: null,
              active: true,
              promoted_to_contact_id: null,
              created_at: "2026-09-09T00:00:00.000Z",
            },
          ],
        });
      }
      if (url.endsWith("/api/v1/bookings/persons") && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({
          contact_id: "c1",
          name: "Theo",
          relation_type: "guardian",
        });
        return mockJson(
          {
            data: {
              person_id: "p2",
              contact_id: "c1",
              name: "Theo",
              birth_year: null,
              relation_type: "guardian",
              relation_label: null,
              notes: null,
              active: true,
              promoted_to_contact_id: null,
              created_at: "2026-09-09T00:00:01.000Z",
            },
          },
          201,
        );
      }
      throw new Error(`unexpected ${url}`);
    });
    const medal = new Medal("medal_test", { baseUrl: BASE });
    const listed = await medal.bookings.persons.list("c1");
    expect(listed.data[0].name).toBe("Nora");
    const created = await medal.bookings.persons.create({
      contact_id: "c1",
      name: "Theo",
      relation_type: "guardian",
    });
    expect(created.data.person_id).toBe("p2");
    vi.restoreAllMocks();
  });

  it("relations.list sends contact_id and relations.create posts the body", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/v1/bookings/relations?contact_id=c1")) {
        return mockJson({
          data: {
            outgoing: [
              {
                relation_id: "r1",
                from_contact_id: "c1",
                to_contact_id: "c2",
                type: "partner",
                custom_label: null,
                since: null,
                note: null,
                counterpart_name: "Kari",
                created_at: "2026-09-09T00:00:00.000Z",
              },
            ],
            incoming: [],
          },
        });
      }
      if (url.endsWith("/api/v1/bookings/relations") && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toEqual({
          from_contact_id: "c1",
          to_contact_id: "c2",
          type: "partner",
        });
        return mockJson({ data: { relation_id: "r2" } }, 201);
      }
      throw new Error(`unexpected ${url}`);
    });
    const medal = new Medal("medal_test", { baseUrl: BASE });
    const listed = await medal.bookings.relations.list("c1");
    expect(listed.data.outgoing[0].counterpart_name).toBe("Kari");
    const created = await medal.bookings.relations.create({
      from_contact_id: "c1",
      to_contact_id: "c2",
      type: "partner",
    });
    expect(created.data.relation_id).toBe("r2");
    vi.restoreAllMocks();
  });

  it("events.list sends from/to and events.get addresses by id", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/bookings/events?from=2026-10-01&to=2026-10-31")) {
        return mockJson({ data: [] });
      }
      if (url.endsWith("/api/v1/bookings/events/e1")) {
        return mockJson({ data: { event_id: "e1", slug: "x", status: "open" } });
      }
      throw new Error(`unexpected ${url}`);
    });
    const medal = new Medal("medal_test", { baseUrl: BASE });
    expect(
      (await medal.bookings.events.list({ from: "2026-10-01", to: "2026-10-31" })).data,
    ).toEqual([]);
    expect((await medal.bookings.events.get("e1")).data.event_id).toBe("e1");
    vi.restoreAllMocks();
  });
});
