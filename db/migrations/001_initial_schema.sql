-- Create legislations table
CREATE TABLE legislations (
    id SERIAL PRIMARY KEY,
    celex_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    full_markdown_content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create articles table
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    legislation_id INTEGER NOT NULL REFERENCES legislations(id),
    article_number_text TEXT NOT NULL,
    title TEXT,
    filename TEXT,
    markdown_content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create case_laws table
CREATE TABLE case_laws (
    id SERIAL PRIMARY KEY,
    celex_number TEXT UNIQUE NOT NULL,
    case_id_text TEXT,
    title TEXT NOT NULL,
    court TEXT,
    date_of_judgment DATE,
    parties TEXT,
    summary_text TEXT,
    operative_parts_combined TEXT,
    operative_parts_individual TEXT,
    html_content TEXT,
    plaintext_content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create operative_parts table
CREATE TABLE operative_parts (
    id SERIAL PRIMARY KEY,
    case_law_id INTEGER NOT NULL REFERENCES case_laws(id),
    part_number INTEGER NOT NULL,
    verbatim_text TEXT,
    simplified_text TEXT,
    markdown_content TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (case_law_id, part_number)
);

-- Create case_law_interprets_article junction table
CREATE TABLE case_law_interprets_article (
    id SERIAL PRIMARY KEY,
    case_law_id INTEGER NOT NULL REFERENCES case_laws(id),
    article_id INTEGER NOT NULL REFERENCES articles(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (case_law_id, article_id)
);

-- Create operative_part_interprets_article junction table
CREATE TABLE operative_part_interprets_article (
    id SERIAL PRIMARY KEY,
    operative_part_id INTEGER NOT NULL REFERENCES operative_parts(id),
    article_id INTEGER NOT NULL REFERENCES articles(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (operative_part_id, article_id)
);

-- Create operative_part_mentions_legislation junction table
CREATE TABLE operative_part_mentions_legislation (
    id SERIAL PRIMARY KEY,
    operative_part_id INTEGER NOT NULL REFERENCES operative_parts(id),
    legislation_id INTEGER NOT NULL REFERENCES legislations(id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (operative_part_id, legislation_id)
);

-- Add indexes
CREATE INDEX idx_legislations_celex_number ON legislations(celex_number);
CREATE INDEX idx_articles_legislation_id ON articles(legislation_id);
CREATE INDEX idx_case_laws_celex_number ON case_laws(celex_number);
CREATE INDEX idx_operative_parts_case_law_id ON operative_parts(case_law_id);
CREATE INDEX idx_case_law_interprets_article_case_law_id ON case_law_interprets_article(case_law_id);
CREATE INDEX idx_case_law_interprets_article_article_id ON case_law_interprets_article(article_id);
CREATE INDEX idx_operative_part_interprets_article_operative_part_id ON operative_part_interprets_article(operative_part_id);
CREATE INDEX idx_operative_part_interprets_article_article_id ON operative_part_interprets_article(article_id);
CREATE INDEX idx_operative_part_mentions_legislation_operative_part_id ON operative_part_mentions_legislation(operative_part_id);
CREATE INDEX idx_operative_part_mentions_legislation_legislation_id ON operative_part_mentions_legislation(legislation_id);

-- Optional: Add triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_legislations_updated_at
BEFORE UPDATE ON legislations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at
BEFORE UPDATE ON articles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_case_laws_updated_at
BEFORE UPDATE ON case_laws
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_operative_parts_updated_at
BEFORE UPDATE ON operative_parts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
