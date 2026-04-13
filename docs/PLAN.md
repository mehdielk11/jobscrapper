# PLAN: Fully Automated & AI-Ranked Job Pipeline

This plan details the implementation of a production-ready scraping and recommendation pipeline for the Job Offers MVP.

## Agents Involved
- `project-planner`: Technical orchestration (Phase 1)
- `backend-specialist`: Cron integration, Scraper/NLP pipeline
- `frontend-specialist`: Advanced Recommendations UI
- `test-engineer`: E2E verification with test-user

## Phase 1: Infrastructure & Backend Refactor
- [ ] **Dependencies**: Add `apscheduler` to `requirements.txt`.
- [ ] **Cron Service**: Integrate `BackgroundScheduler` in `backend/main.py` to trigger full pipeline every 6 hours.
- [ ] **Manual Trigger**: Implement `POST /api/scrape/run` endpoint.
- [ ] **NLP-Scraper Link**: Refactor `scraper_runner.py` to call `SkillsExtractor.process_all_jobs()` upon completion of a scrape batch.

## Phase 2: UI Overhaul
- [ ] **API Update**: Expose `triggerScrape` in `lib/api.ts`.
- [ ] **Recommendations Features**:
    - [ ] Add Search Bar (Job title/Company).
    - [ ] Add Filters (Source, Location).
    - [ ] Add Sorting options.
    - [ ] Implement Pagination logic.
    - [ ] Add "Show Low-Score Matches" toggle (Current default: 60%+).
    - [ ] Add "Refresh Jobs Now" button.

## Phase 3: Validation
- [ ] **Data Flow**: Run the full pipeline and verify job skills are correctly populated in Supabase.
- [ ] **User Context**: Login as `elkhemlichi.mehdi@gmail.com` and verify match scores are positive and correctly filtered.
- [ ] **Safety Scan**: Run `security_scan.py` and `lint_runner.py`.

## Verification Details
- **Test Account**: `elkhemlichi.mehdi@gmail.com`
- **Success Criteria**: 
    1. Scrapers run without failing on 4/6 sites.
    2. Recommendations tab shows real jobs with >60% match.
    3. Pagination and Search work responsively.
