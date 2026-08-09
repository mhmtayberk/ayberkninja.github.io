#!/usr/bin/env ruby
# frozen_string_literal: true

require "date"
require "fileutils"
require "optparse"
require "pathname"
require "yaml"

ROOT = Pathname(__dir__).join("..").expand_path
OUTPUT_DIR = ROOT.join("markdown-mirrors")
SITE_URL = "https://ayberk.ninja"
AUTHOR_NAME = "Mehmet Ayberk"
AUTHOR_URL = "#{SITE_URL}/about.html"

FRONT_MATTER = /\A---[ \t]*\r?\n(?<yaml>.*?)\r?\n---[ \t]*\r?\n/m

def read_document(path)
  source = path
    .read(encoding: "UTF-8")
    .gsub("\r\n", "\n")
    .gsub(/[ \t]+$/, "")
  match = FRONT_MATTER.match(source)
  raise "Missing YAML front matter: #{path.relative_path_from(ROOT)}" unless match

  data = YAML.safe_load(
    match[:yaml],
    permitted_classes: [Date, Time],
    aliases: true
  ) || {}

  [data.transform_keys(&:to_s), source[match.end(0)..].to_s.strip]
end

def public_route(path, data)
  route = data["permalink"]
  return route.start_with?("/") ? route : "/#{route}" if route

  "/#{path.basename(path.extname)}.html"
end

def markdown_route(route)
  route = "/#{route}" unless route.start_with?("/")
  route.end_with?("/") ? "#{route}index.html.md" : "#{route}.md"
end

def iso_date(value)
  return if value.nil?

  value.respond_to?(:iso8601) ? value.iso8601 : value.to_s
end

def language_name(code)
  { "en" => "English", "tr" => "Türkçe" }.fetch(code.to_s, code.to_s)
end

def mirror_source(data:, body:, route:, post:)
  if body.include?("{% endraw %}")
    raise "The source contains a Liquid endraw tag and cannot be mirrored safely: #{route}"
  end

  canonical_url = "#{SITE_URL}#{route}"
  mirror_url = markdown_route(route)
  metadata = []
  metadata << "- Author: [#{AUTHOR_NAME}](#{AUTHOR_URL})"
  metadata << "- Published: #{iso_date(data["date"])}" if post && data["date"]
  metadata << "- Updated: #{iso_date(data["last_modified_at"])}" if data["last_modified_at"]
  metadata << "- Language: #{language_name(data.fetch("lang", "en"))}"
  metadata << "- Canonical: [#{canonical_url}](#{canonical_url})"

  <<~MARKDOWN
    ---
    layout: null
    permalink: #{mirror_url}
    sitemap: false
    ---
    {% raw %}# #{data.fetch("title")}

    > #{data.fetch("description")}

    #{metadata.join("\n")}

    #{body}
    {% endraw %}
  MARKDOWN
end

def documents
  posts = Dir[ROOT.join("all_collections/_posts/*.md")].sort.filter_map do |name|
    path = Pathname(name)
    data, body = read_document(path)
    next if data["published"] == false

    [path, data, body, true]
  end

  pages = %w[about.md zeroDay.md presentation.md].map do |name|
    path = ROOT.join(name)
    data, body = read_document(path)
    [path, data, body, false]
  end

  posts + pages
end

def expected_files
  documents.to_h do |path, data, body, post|
    route = public_route(path, data)
    output_name = path.basename(path.extname).to_s.sub(/\A\d{4}-\d{2}-\d{2}-/, "")
    output = OUTPUT_DIR.join("#{output_name}.txt")
    [output, mirror_source(data: data, body: body, route: route, post: post)]
  end
end

options = { check: false }
OptionParser.new do |parser|
  parser.banner = "Usage: ruby scripts/generate_markdown_mirrors.rb [--check]"
  parser.on("--check", "Fail if generated Markdown mirrors are stale") { options[:check] = true }
end.parse!

expected = expected_files
existing = OUTPUT_DIR.directory? ? OUTPUT_DIR.glob("*.txt") : []
unexpected = existing - expected.keys
stale = expected.filter_map do |path, content|
  path unless path.file? && path.read(encoding: "UTF-8") == content
end

if options[:check]
  problems = stale + unexpected
  if problems.empty?
    puts "Markdown mirrors are up to date (#{expected.length} files)."
    exit 0
  end

  warn "Markdown mirrors are stale:"
  problems.sort.each { |path| warn "- #{path.relative_path_from(ROOT)}" }
  warn "Run: ruby scripts/generate_markdown_mirrors.rb"
  exit 1
end

FileUtils.mkdir_p(OUTPUT_DIR)
expected.each { |path, content| path.write(content, encoding: "UTF-8") }
unexpected.each(&:delete)
puts "Generated #{expected.length} Markdown mirrors in #{OUTPUT_DIR.relative_path_from(ROOT)}."
