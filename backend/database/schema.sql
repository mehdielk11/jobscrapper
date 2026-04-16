-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Jobs table
create table if not exists jobs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  company text not null,
  location text,
  description text,
  source text not null,
  url text unique not null,
  scraped_at timestamp with time zone default now()
);

-- Job skills table
create table if not exists job_skills (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references jobs(id) on delete cascade,
  skill text not null
);

-- Student profiles table (linked to Supabase auth users)
create table if not exists students (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamp with time zone default now(),
  unique(auth_user_id)
);

-- Student skills table
create table if not exists student_skills (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) on delete cascade,
  skill text not null
);

-- Row Level Security (RLS)
alter table students enable row level security;
alter table student_skills enable row level security;

-- RLS Policies: students can only read/write their own data
create policy "Students can read own profile"
  on students for select using (auth.uid() = auth_user_id);

create policy "Students can insert own profile"
  on students for insert with check (auth.uid() = auth_user_id);

create policy "Students can update own profile"
  on students for update using (auth.uid() = auth_user_id);

create policy "Students can read own skills"
  on student_skills for select
  using (student_id in (select id from students where auth_user_id = auth.uid()));

create policy "Students can insert own skills"
  on student_skills for insert
  with check (student_id in (select id from students where auth_user_id = auth.uid()));

create policy "Students can delete own skills"
  on student_skills for delete
  using (student_id in (select id from students where auth_user_id = auth.uid()));

-- Jobs and job_skills are public read, service-role write (scrapers use service key)
alter table jobs enable row level security;
alter table job_skills enable row level security;

create policy "Anyone can read jobs"
  on jobs for select using (true);

create policy "Anyone can read job skills"
  on job_skills for select using (true);
