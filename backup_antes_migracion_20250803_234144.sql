--
-- PostgreSQL database dump
--

-- Dumped from database version 15.3 (Debian 15.3-1.pgdg120+1)
-- Dumped by pg_dump version 15.3 (Debian 15.3-1.pgdg120+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: categories_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.categories_status_enum AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE public.categories_status_enum OWNER TO postgres;

--
-- Name: customers_documenttype_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.customers_documenttype_enum AS ENUM (
    'cc',
    'nit',
    'ce',
    'passport',
    'other'
);


ALTER TYPE public.customers_documenttype_enum OWNER TO postgres;

--
-- Name: customers_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.customers_status_enum AS ENUM (
    'active',
    'inactive',
    'suspended'
);


ALTER TYPE public.customers_status_enum OWNER TO postgres;

--
-- Name: expense_categories_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.expense_categories_status_enum AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE public.expense_categories_status_enum OWNER TO postgres;

--
-- Name: expenses_paymentmethod_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.expenses_paymentmethod_enum AS ENUM (
    'cash',
    'credit_card',
    'debit_card',
    'bank_transfer',
    'check',
    'other'
);


ALTER TYPE public.expenses_paymentmethod_enum OWNER TO postgres;

--
-- Name: expenses_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.expenses_status_enum AS ENUM (
    'draft',
    'pending',
    'approved',
    'rejected',
    'paid'
);


ALTER TYPE public.expenses_status_enum OWNER TO postgres;

--
-- Name: expenses_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.expenses_type_enum AS ENUM (
    'operating',
    'administrative',
    'sales',
    'financial',
    'extraordinary'
);


ALTER TYPE public.expenses_type_enum OWNER TO postgres;

--
-- Name: invoices_paymentmethod_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.invoices_paymentmethod_enum AS ENUM (
    'cash',
    'credit_card',
    'debit_card',
    'bank_transfer',
    'check',
    'credit',
    'other'
);


ALTER TYPE public.invoices_paymentmethod_enum OWNER TO postgres;

--
-- Name: invoices_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.invoices_status_enum AS ENUM (
    'draft',
    'pending',
    'paid',
    'overdue',
    'cancelled',
    'partially_paid'
);


ALTER TYPE public.invoices_status_enum OWNER TO postgres;

--
-- Name: product_prices_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.product_prices_status_enum AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE public.product_prices_status_enum OWNER TO postgres;

--
-- Name: product_prices_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.product_prices_type_enum AS ENUM (
    'price1',
    'price2',
    'price3',
    'special',
    'cost'
);


ALTER TYPE public.product_prices_type_enum OWNER TO postgres;

--
-- Name: products_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.products_status_enum AS ENUM (
    'active',
    'inactive',
    'out_of_stock'
);


ALTER TYPE public.products_status_enum OWNER TO postgres;

--
-- Name: products_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.products_type_enum AS ENUM (
    'product',
    'service'
);


ALTER TYPE public.products_type_enum OWNER TO postgres;

--
-- Name: subscriptions_plan_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.subscriptions_plan_enum AS ENUM (
    'trial',
    'basic',
    'premium',
    'enterprise'
);


ALTER TYPE public.subscriptions_plan_enum OWNER TO postgres;

--
-- Name: subscriptions_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.subscriptions_status_enum AS ENUM (
    'active',
    'expired',
    'cancelled',
    'suspended',
    'pending'
);


ALTER TYPE public.subscriptions_status_enum OWNER TO postgres;

--
-- Name: subscriptions_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.subscriptions_type_enum AS ENUM (
    'trial',
    'monthly',
    'yearly',
    'lifetime'
);


ALTER TYPE public.subscriptions_type_enum OWNER TO postgres;

--
-- Name: users_role_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.users_role_enum AS ENUM (
    'admin',
    'user',
    'manager'
);


ALTER TYPE public.users_role_enum OWNER TO postgres;

--
-- Name: users_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.users_status_enum AS ENUM (
    'active',
    'inactive',
    'suspended'
);


ALTER TYPE public.users_status_enum OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(100) NOT NULL,
    description text,
    slug character varying(50) NOT NULL,
    image text,
    status public.categories_status_enum DEFAULT 'active'::public.categories_status_enum NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    organization_id uuid NOT NULL,
    parent_id uuid
);


ALTER TABLE public.categories OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    "firstName" character varying(100) NOT NULL,
    "lastName" character varying(100) NOT NULL,
    "companyName" character varying(100),
    email character varying(255) NOT NULL,
    phone character varying(20),
    mobile character varying(20),
    "documentType" public.customers_documenttype_enum DEFAULT 'cc'::public.customers_documenttype_enum NOT NULL,
    "documentNumber" character varying(50) NOT NULL,
    address text,
    city character varying(100),
    state character varying(100),
    "zipCode" character varying(20),
    country character varying(100),
    status public.customers_status_enum DEFAULT 'active'::public.customers_status_enum NOT NULL,
    organization_id uuid NOT NULL,
    "creditLimit" numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    "currentBalance" numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    "paymentTerms" integer DEFAULT 30 NOT NULL,
    "birthDate" date,
    notes text,
    metadata json,
    "lastPurchaseAt" timestamp without time zone,
    "totalPurchases" numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    "totalOrders" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_categories (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(100) NOT NULL,
    description text,
    color character varying(7),
    status public.expense_categories_status_enum DEFAULT 'active'::public.expense_categories_status_enum NOT NULL,
    "monthlyBudget" numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    "isRequired" boolean DEFAULT false NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    organization_id uuid NOT NULL
);


ALTER TABLE public.expense_categories OWNER TO postgres;

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    description character varying(200) NOT NULL,
    amount numeric(12,2) NOT NULL,
    date date NOT NULL,
    status public.expenses_status_enum DEFAULT 'draft'::public.expenses_status_enum NOT NULL,
    type public.expenses_type_enum DEFAULT 'operating'::public.expenses_type_enum NOT NULL,
    "paymentMethod" public.expenses_paymentmethod_enum DEFAULT 'cash'::public.expenses_paymentmethod_enum NOT NULL,
    vendor character varying(100),
    "invoiceNumber" character varying(50),
    reference character varying(100),
    notes text,
    attachments json,
    tags json,
    metadata json,
    "approvedById" uuid,
    "approvedAt" timestamp without time zone,
    "rejectionReason" text,
    organization_id uuid NOT NULL,
    "categoryId" uuid NOT NULL,
    "createdById" uuid NOT NULL,
    category_id uuid,
    created_by_id uuid,
    approved_by_id uuid
);


ALTER TABLE public.expenses OWNER TO postgres;

--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    description character varying(200) NOT NULL,
    quantity double precision NOT NULL,
    "unitPrice" double precision NOT NULL,
    "discountPercentage" double precision DEFAULT '0'::double precision NOT NULL,
    "discountAmount" double precision DEFAULT '0'::double precision NOT NULL,
    subtotal double precision NOT NULL,
    unit character varying(20),
    notes text,
    "invoiceId" uuid,
    "productId" uuid,
    "temporaryProductId" uuid
);


ALTER TABLE public.invoice_items OWNER TO postgres;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    number character varying(50) NOT NULL,
    date date NOT NULL,
    "dueDate" date NOT NULL,
    status public.invoices_status_enum DEFAULT 'draft'::public.invoices_status_enum NOT NULL,
    "paymentMethod" public.invoices_paymentmethod_enum DEFAULT 'cash'::public.invoices_paymentmethod_enum NOT NULL,
    subtotal double precision DEFAULT '0'::double precision NOT NULL,
    "taxPercentage" double precision DEFAULT '0'::double precision NOT NULL,
    "taxAmount" double precision DEFAULT '0'::double precision NOT NULL,
    "discountPercentage" double precision DEFAULT '0'::double precision NOT NULL,
    "discountAmount" double precision DEFAULT '0'::double precision NOT NULL,
    total double precision DEFAULT '0'::double precision NOT NULL,
    "paidAmount" double precision DEFAULT '0'::double precision NOT NULL,
    "balanceDue" double precision DEFAULT '0'::double precision NOT NULL,
    notes text,
    terms text,
    metadata json,
    organization_id uuid NOT NULL,
    "customerId" uuid NOT NULL,
    "createdById" uuid NOT NULL
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(255) NOT NULL,
    slug character varying(100) NOT NULL,
    domain character varying(255),
    logo text,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    "subscriptionPlan" character varying(50),
    "subscriptionStatus" character varying(50),
    "subscriptionStartDate" timestamp without time zone,
    "subscriptionEndDate" timestamp without time zone,
    "trialStartDate" timestamp without time zone,
    "trialEndDate" timestamp without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    locale character varying(10) DEFAULT 'en'::character varying NOT NULL,
    timezone character varying(50) DEFAULT 'America/New_York'::character varying NOT NULL
);


ALTER TABLE public.organizations OWNER TO postgres;

--
-- Name: product_prices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_prices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    type public.product_prices_type_enum NOT NULL,
    name character varying(100),
    amount numeric(12,2) NOT NULL,
    currency character varying(3) DEFAULT 'COP'::character varying NOT NULL,
    status public.product_prices_status_enum DEFAULT 'active'::public.product_prices_status_enum NOT NULL,
    "validFrom" timestamp without time zone,
    "validTo" timestamp without time zone,
    "discountPercentage" numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    "discountAmount" numeric(12,2),
    "minQuantity" integer DEFAULT 1 NOT NULL,
    "profitMargin" numeric(5,2),
    notes text,
    "productId" uuid NOT NULL,
    product_id uuid
);


ALTER TABLE public.product_prices OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(100) NOT NULL,
    description text,
    sku character varying(50) NOT NULL,
    barcode character varying(20),
    type public.products_type_enum DEFAULT 'product'::public.products_type_enum NOT NULL,
    status public.products_status_enum DEFAULT 'active'::public.products_status_enum NOT NULL,
    stock numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "minStock" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    unit character varying(50),
    weight numeric(10,2),
    length numeric(10,2),
    width numeric(10,2),
    height numeric(10,2),
    images text[],
    metadata json,
    organization_id uuid NOT NULL,
    category_id uuid NOT NULL,
    created_by_id uuid NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    "organizationId" uuid NOT NULL,
    plan public.subscriptions_plan_enum DEFAULT 'trial'::public.subscriptions_plan_enum NOT NULL,
    status public.subscriptions_status_enum DEFAULT 'active'::public.subscriptions_status_enum NOT NULL,
    type public.subscriptions_type_enum DEFAULT 'trial'::public.subscriptions_type_enum NOT NULL,
    "startDate" timestamp without time zone NOT NULL,
    "endDate" timestamp without time zone NOT NULL,
    "cancelledAt" timestamp without time zone,
    "cancelReason" character varying(255),
    price numeric(10,2),
    currency character varying(10),
    "paymentMethod" character varying(255),
    "externalSubscriptionId" character varying(255),
    metadata jsonb,
    "maxUsers" integer DEFAULT '-1'::integer NOT NULL,
    "lastBillingDate" timestamp without time zone,
    "nextBillingDate" timestamp without time zone,
    "billingCycle" integer DEFAULT 0 NOT NULL,
    "autoRenew" boolean DEFAULT true NOT NULL,
    "trialEndsAt" timestamp without time zone,
    "isTrialUsed" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.subscriptions OWNER TO postgres;

--
-- Name: temporary_products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.temporary_products (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    name character varying(200) NOT NULL,
    description text,
    "unitPrice" double precision NOT NULL,
    unit character varying(20) DEFAULT 'pcs'::character varying NOT NULL,
    currency character varying(10) DEFAULT 'COP'::character varying NOT NULL,
    category character varying(100),
    metadata json
);


ALTER TABLE public.temporary_products OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    "firstName" character varying(100) NOT NULL,
    "lastName" character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    phone character varying(20),
    role public.users_role_enum DEFAULT 'user'::public.users_role_enum NOT NULL,
    status public.users_status_enum DEFAULT 'active'::public.users_status_enum NOT NULL,
    "lastLoginAt" timestamp without time zone,
    avatar text,
    organization_id uuid NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, created_at, updated_at, deleted_at, name, description, slug, image, status, "sortOrder", organization_id, parent_id) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, created_at, updated_at, deleted_at, "firstName", "lastName", "companyName", email, phone, mobile, "documentType", "documentNumber", address, city, state, "zipCode", country, status, organization_id, "creditLimit", "currentBalance", "paymentTerms", "birthDate", notes, metadata, "lastPurchaseAt", "totalPurchases", "totalOrders") FROM stdin;
\.


--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expense_categories (id, created_at, updated_at, deleted_at, name, description, color, status, "monthlyBudget", "isRequired", "sortOrder", organization_id) FROM stdin;
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expenses (id, created_at, updated_at, deleted_at, description, amount, date, status, type, "paymentMethod", vendor, "invoiceNumber", reference, notes, attachments, tags, metadata, "approvedById", "approvedAt", "rejectionReason", organization_id, "categoryId", "createdById", category_id, created_by_id, approved_by_id) FROM stdin;
\.


--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_items (id, created_at, updated_at, deleted_at, description, quantity, "unitPrice", "discountPercentage", "discountAmount", subtotal, unit, notes, "invoiceId", "productId", "temporaryProductId") FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, created_at, updated_at, deleted_at, number, date, "dueDate", status, "paymentMethod", subtotal, "taxPercentage", "taxAmount", "discountPercentage", "discountAmount", total, "paidAmount", "balanceDue", notes, terms, metadata, organization_id, "customerId", "createdById") FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, created_at, updated_at, deleted_at, name, slug, domain, logo, settings, "subscriptionPlan", "subscriptionStatus", "subscriptionStartDate", "subscriptionEndDate", "trialStartDate", "trialEndDate", "isActive", currency, locale, timezone) FROM stdin;
\.


--
-- Data for Name: product_prices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_prices (id, created_at, updated_at, deleted_at, type, name, amount, currency, status, "validFrom", "validTo", "discountPercentage", "discountAmount", "minQuantity", "profitMargin", notes, "productId", product_id) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, created_at, updated_at, deleted_at, name, description, sku, barcode, type, status, stock, "minStock", unit, weight, length, width, height, images, metadata, organization_id, category_id, created_by_id) FROM stdin;
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (id, created_at, updated_at, deleted_at, "organizationId", plan, status, type, "startDate", "endDate", "cancelledAt", "cancelReason", price, currency, "paymentMethod", "externalSubscriptionId", metadata, "maxUsers", "lastBillingDate", "nextBillingDate", "billingCycle", "autoRenew", "trialEndsAt", "isTrialUsed") FROM stdin;
\.


--
-- Data for Name: temporary_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.temporary_products (id, created_at, updated_at, deleted_at, name, description, "unitPrice", unit, currency, category, metadata) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, created_at, updated_at, deleted_at, "firstName", "lastName", email, password, phone, role, status, "lastLoginAt", avatar, organization_id) FROM stdin;
\.


--
-- Name: products PK_0806c755e0aca124e67c0cf6d7d; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY (id);


--
-- Name: customers PK_133ec679a801fab5e070f73d3ea; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY (id);


--
-- Name: categories PK_24dbc6126a28ff948da33e97d3b; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY (id);


--
-- Name: product_prices PK_31c33ddacf759f7c0e5d327c4bb; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT "PK_31c33ddacf759f7c0e5d327c4bb" PRIMARY KEY (id);


--
-- Name: invoice_items PK_53b99f9e0e2945e69de1a12b75a; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT "PK_53b99f9e0e2945e69de1a12b75a" PRIMARY KEY (id);


--
-- Name: invoices PK_668cef7c22a427fd822cc1be3ce; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY (id);


--
-- Name: organizations PK_6b031fcd0863e3f6b44230163f9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY (id);


--
-- Name: expenses PK_94c3ceb17e3140abc9282c20610; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY (id);


--
-- Name: users PK_a3ffb1c0c8416b9fc6f907b7433; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id);


--
-- Name: subscriptions PK_a87248d73155605cf782be9ee5e; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY (id);


--
-- Name: expense_categories PK_d0ef31e189d9523461215b62775; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT "PK_d0ef31e189d9523461215b62775" PRIMARY KEY (id);


--
-- Name: temporary_products PK_f74dc939c362e1460d56b69e68f; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.temporary_products
    ADD CONSTRAINT "PK_f74dc939c362e1460d56b69e68f" PRIMARY KEY (id);


--
-- Name: invoices UQ_6b20aa66f2a835a4f2fbde48724; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "UQ_6b20aa66f2a835a4f2fbde48724" UNIQUE (number);


--
-- Name: customers UQ_8536b8b85c06969f84f0c098b03; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "UQ_8536b8b85c06969f84f0c098b03" UNIQUE (email);


--
-- Name: organizations UQ_963693341bd612aa01ddf3a4b68; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "UQ_963693341bd612aa01ddf3a4b68" UNIQUE (slug);


--
-- Name: users UQ_97672ac88f789774dd47f7c8be3; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email);


--
-- Name: organizations UQ_98678ed828cc71e4f8a58c95d6b; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "UQ_98678ed828cc71e4f8a58c95d6b" UNIQUE (domain);


--
-- Name: products UQ_c44ac33a05b144dd0d9ddcf9327; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "UQ_c44ac33a05b144dd0d9ddcf9327" UNIQUE (sku);


--
-- Name: customers UQ_customer_document_organization; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "UQ_customer_document_organization" UNIQUE ("documentType", "documentNumber", organization_id);


--
-- Name: customers UQ_customer_email_organization; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "UQ_customer_email_organization" UNIQUE (email, organization_id);


--
-- Name: customers UQ_dffea8343d90688bccac70b63ad; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "UQ_dffea8343d90688bccac70b63ad" UNIQUE ("documentNumber");


--
-- Name: IDX_21a659804ed7bf61eb91688dea; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_21a659804ed7bf61eb91688dea" ON public.users USING btree (organization_id);


--
-- Name: IDX_2d404aa7aa4a0404eafd184091; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_2d404aa7aa4a0404eafd184091" ON public.products USING btree (organization_id);


--
-- Name: IDX_47784468bc789a4e58fa64b4b3; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_47784468bc789a4e58fa64b4b3" ON public.expenses USING btree (organization_id);


--
-- Name: IDX_4badeb2e2fbc3b527a60aea8e0; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_4badeb2e2fbc3b527a60aea8e0" ON public.subscriptions USING btree ("endDate");


--
-- Name: IDX_75d13c3db9911d22fd5a64d37a; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_75d13c3db9911d22fd5a64d37a" ON public.subscriptions USING btree (plan, status);


--
-- Name: IDX_963693341bd612aa01ddf3a4b6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_963693341bd612aa01ddf3a4b6" ON public.organizations USING btree (slug);


--
-- Name: IDX_98678ed828cc71e4f8a58c95d6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_98678ed828cc71e4f8a58c95d6" ON public.organizations USING btree (domain);


--
-- Name: IDX_a713916d96f313cb62dd563df1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_a713916d96f313cb62dd563df1" ON public.expense_categories USING btree (organization_id);


--
-- Name: IDX_a7a84c705f3e8e4fbd497cfb11; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_a7a84c705f3e8e4fbd497cfb11" ON public.subscriptions USING btree ("organizationId");


--
-- Name: IDX_bfac25cac85a4c76e896d5cfa1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_bfac25cac85a4c76e896d5cfa1" ON public.categories USING btree (organization_id);


--
-- Name: IDX_d2fc0e42b07d01fafc3fbb2bee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_d2fc0e42b07d01fafc3fbb2bee" ON public.customers USING btree (organization_id);


--
-- Name: IDX_d4e095bcd100de447d3c27708f; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_d4e095bcd100de447d3c27708f" ON public.invoices USING btree (organization_id);


--
-- Name: IDX_eeb28b686a8c3472a22d67d239; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_eeb28b686a8c3472a22d67d239" ON public.subscriptions USING btree ("organizationId", status);


--
-- Name: UQ_categories_slug_not_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "UQ_categories_slug_not_deleted" ON public.categories USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: UQ_categories_slug_organization_not_deleted; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "UQ_categories_slug_organization_not_deleted" ON public.categories USING btree (slug, organization_id) WHERE (deleted_at IS NULL);


--
-- Name: invoice_items FK_019761c984ef92753c2af65ef15; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT "FK_019761c984ef92753c2af65ef15" FOREIGN KEY ("temporaryProductId") REFERENCES public.temporary_products(id) ON DELETE SET NULL;


--
-- Name: invoices FK_1df049f8943c6be0c1115541efb; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "FK_1df049f8943c6be0c1115541efb" FOREIGN KEY ("customerId") REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: users FK_21a659804ed7bf61eb91688dea7; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "FK_21a659804ed7bf61eb91688dea7" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: products FK_2d404aa7aa4a0404eafd1840915; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "FK_2d404aa7aa4a0404eafd1840915" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: expenses FK_47784468bc789a4e58fa64b4b3e; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_47784468bc789a4e58fa64b4b3e" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: expenses FK_5d1f4be708e0dfe2afa1a3c376c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_5d1f4be708e0dfe2afa1a3c376c" FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE RESTRICT;


--
-- Name: products FK_6dc43b3c8cbde659f3cf9765198; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "FK_6dc43b3c8cbde659f3cf9765198" FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: invoice_items FK_7bec360ed9928668b73dac2ec17; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT "FK_7bec360ed9928668b73dac2ec17" FOREIGN KEY ("productId") REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: invoice_items FK_7fb6895fc8fad9f5200e91abb59; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT "FK_7fb6895fc8fad9f5200e91abb59" FOREIGN KEY ("invoiceId") REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: product_prices FK_8218c69c7f5a3706662101fa788; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_prices
    ADD CONSTRAINT "FK_8218c69c7f5a3706662101fa788" FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: categories FK_88cea2dc9c31951d06437879b40; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;


--
-- Name: products FK_9a5f6868c96e0069e699f33e124; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT "FK_9a5f6868c96e0069e699f33e124" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: expense_categories FK_a713916d96f313cb62dd563df19; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT "FK_a713916d96f313cb62dd563df19" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: subscriptions FK_a7a84c705f3e8e4fbd497cfb119; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT "FK_a7a84c705f3e8e4fbd497cfb119" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);


--
-- Name: categories FK_bfac25cac85a4c76e896d5cfa16; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT "FK_bfac25cac85a4c76e896d5cfa16" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: expenses FK_cb8a9ecdb628ea1befdbaf6e078; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_cb8a9ecdb628ea1befdbaf6e078" FOREIGN KEY (created_by_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: customers FK_d2fc0e42b07d01fafc3fbb2bee3; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT "FK_d2fc0e42b07d01fafc3fbb2bee3" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: invoices FK_d4e095bcd100de447d3c27708f9; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "FK_d4e095bcd100de447d3c27708f9" FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: invoices FK_dc9c84f58ab53b5c844c276e435; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "FK_dc9c84f58ab53b5c844c276e435" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: expenses FK_ec5e1979babccacbc2e64f531ef; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_ec5e1979babccacbc2e64f531ef" FOREIGN KEY (approved_by_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

