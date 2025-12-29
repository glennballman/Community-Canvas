# Community Status Dashboard Documentation

> Documentation Library v1.0.0
> Last Updated: December 29, 2025

Welcome to the documentation library for the Community Status Dashboard project.

---

## Quick Links

| Document | Description |
|----------|-------------|
| [Data Collection Guide](./DATA_COLLECTION.md) | How to collect, process, and store chamber member data |
| [System Architecture](./ARCHITECTURE.md) | Technical architecture and data models |

---

## Project Status

### Current Scope: British Columbia
- **Chambers**: 107 total
- **Completed**: Tracking in real-time
- **Target**: 80%+ completion for 80%+ of chambers

### Expansion Roadmap
1. British Columbia (Current)
2. Alberta (Next)
3. Ontario
4. Quebec
5. Remaining Canadian Provinces
6. US States (border states first)

---

## Key Concepts

### Completion Criteria
A chamber is **COMPLETED** when:
- 30+ members collected
- 80%+ of target (Expected or Estimated) collected

### Expected vs Estimated
- **Expected** (cyan): Official count from chamber website
- **Estimated** (orange): Calculated from actual count × 1.2 or region defaults

### Status Colors
| Color | Status | Meaning |
|-------|--------|---------|
| Green | Completed | Both criteria met |
| Yellow/Orange | Partial | Has data, missing criteria |
| Gray | Pending | No data yet |
| Blue | In Progress | Being worked on |
| Red | Blocked | Cannot proceed |

---

## Quick Reference

### Tool Selection
| Content Type | Use |
|--------------|-----|
| Static HTML | Firecrawl |
| JavaScript-rendered | Playwright |
| Infinite scroll | Playwright |
| Paginated lists | Firecrawl |

### NAICS Assignment
Every member needs a NAICS code. Common codes:
- 44-45: Retail
- 72: Accommodation & Food
- 54: Professional Services
- 23: Construction
- 62: Health Care

### Required Fields (per member)
- `id`: Unique identifier
- `chamberId`: Which chamber
- `name`: Business name
- `naicsCode`: Industry classification
- `dateAdded`: When collected (NEW)

---

## Contributing

When updating documentation:
1. Edit the relevant `.md` file in `/docs`
2. Update "Last Updated" date
3. Add entry to Version History
4. Test rendering in documentation viewer

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-12-29 | Initial documentation for BC |

---

*Access this documentation at `/docs` in the application.*
