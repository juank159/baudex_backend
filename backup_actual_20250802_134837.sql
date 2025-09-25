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
-- Name: activities_category_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.activities_category_enum AS ENUM (
    'financial',
    'inventory',
    'customer',
    'system',
    'security',
    'analytics'
);


ALTER TYPE public.activities_category_enum OWNER TO postgres;

--
-- Name: activities_priority_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.activities_priority_enum AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE public.activities_priority_enum OWNER TO postgres;

--
-- Name: activities_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.activities_type_enum AS ENUM (
    'invoice_created',
    'invoice_updated',
    'invoice_paid',
    'invoice_partially_paid',
    'invoice_cancelled',
    'invoice_overdue',
    'payment_received',
    'payment_failed',
    'product_created',
    'product_updated',
    'product_deleted',
    'stock_low',
    'stock_out',
    'stock_replenished',
    'customer_created',
    'customer_updated',
    'customer_deleted',
    'expense_created',
    'expense_updated',
    'expense_approved',
    'expense_rejected',
    'expense_paid',
    'user_login',
    'user_logout',
    'user_failed_login',
    'settings_updated',
    'backup_created',
    'data_exported',
    'data_imported',
    'report_generated',
    'dashboard_viewed',
    'bulk_action_performed'
);


ALTER TYPE public.activities_type_enum OWNER TO postgres;

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
-- Name: notifications_priority_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notifications_priority_enum AS ENUM (
    'critical',
    'high',
    'medium',
    'low'
);


ALTER TYPE public.notifications_priority_enum OWNER TO postgres;

--
-- Name: notifications_status_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notifications_status_enum AS ENUM (
    'pending',
    'sent',
    'delivered',
    'read',
    'archived',
    'failed'
);


ALTER TYPE public.notifications_status_enum OWNER TO postgres;

--
-- Name: notifications_type_enum; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.notifications_type_enum AS ENUM (
    'invoice_overdue',
    'stock_out',
    'payment_failed',
    'security_breach',
    'system_error',
    'invoice_due_soon',
    'stock_low',
    'large_payment_received',
    'monthly_report_ready',
    'customer_credit_limit',
    'payment_received',
    'new_customer',
    'backup_completed',
    'invoice_sent',
    'product_low_stock_warning',
    'sales_milestone',
    'new_feature_available',
    'performance_report'
);


ALTER TYPE public.notifications_type_enum OWNER TO postgres;

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
-- Name: activities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activities (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type public.activities_type_enum NOT NULL,
    category public.activities_category_enum NOT NULL,
    priority public.activities_priority_enum DEFAULT 'medium'::public.activities_priority_enum NOT NULL,
    title character varying NOT NULL,
    description text NOT NULL,
    "entityId" character varying,
    "entityType" character varying,
    metadata jsonb,
    icon character varying NOT NULL,
    color character varying NOT NULL,
    "isSystemGenerated" boolean DEFAULT false NOT NULL,
    "ipAddress" character varying,
    "userAgent" character varying,
    "userId" uuid NOT NULL,
    "organizationId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.activities OWNER TO postgres;

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
-- Name: migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


ALTER TABLE public.migrations OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.migrations_id_seq OWNER TO postgres;

--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type public.notifications_type_enum NOT NULL,
    priority public.notifications_priority_enum DEFAULT 'medium'::public.notifications_priority_enum NOT NULL,
    status public.notifications_status_enum DEFAULT 'pending'::public.notifications_status_enum NOT NULL,
    channels text NOT NULL,
    title character varying NOT NULL,
    message text NOT NULL,
    "richContent" text,
    "entityId" character varying,
    "entityType" character varying,
    "actionUrl" character varying,
    "actionLabel" character varying,
    metadata jsonb,
    icon character varying NOT NULL,
    color character varying NOT NULL,
    "scheduledFor" timestamp without time zone,
    "expiresAt" timestamp without time zone,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "maxRetries" integer DEFAULT 3 NOT NULL,
    "sentAt" timestamp without time zone,
    "deliveredAt" timestamp without time zone,
    "readAt" timestamp without time zone,
    "archivedAt" timestamp without time zone,
    "isGrouped" boolean DEFAULT false NOT NULL,
    "groupKey" character varying,
    "userId" uuid NOT NULL,
    "organizationId" uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

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
    "isActive" boolean DEFAULT true NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    locale character varying(10) DEFAULT 'en'::character varying NOT NULL,
    timezone character varying(50) DEFAULT 'America/New_York'::character varying NOT NULL,
    "subscriptionStartDate" timestamp without time zone,
    "subscriptionEndDate" timestamp without time zone,
    "trialStartDate" timestamp without time zone,
    "trialEndDate" timestamp without time zone,
    "subscriptionPlan" character varying(50),
    "subscriptionStatus" character varying(50)
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
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Data for Name: activities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activities (id, type, category, priority, title, description, "entityId", "entityType", metadata, icon, color, "isSystemGenerated", "ipAddress", "userAgent", "userId", "organizationId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.categories (id, created_at, updated_at, deleted_at, name, description, slug, image, status, "sortOrder", organization_id, parent_id) FROM stdin;
71883010-7627-48fd-99d9-8a52fd0f6043	2025-08-02 04:01:53.005332	2025-08-02 04:01:53.005332	\N	General	\N	general	\N	active	1	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	\N
2233d449-005d-450f-a1d0-10ca7e281b19	2025-08-02 04:03:28.336809	2025-08-02 04:03:28.336809	\N	general	\N	general	\N	active	1	8970d85a-4254-4066-800d-10150a9c5135	\N
5366fc01-fcd4-4eb2-9b3a-2da29393e0a5	2025-08-02 05:17:39.332658	2025-08-02 05:17:39.332658	\N	Lacteos	\N	lacteos	\N	active	2	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	\N
05ef5710-5f62-4b32-b527-930cc323a049	2025-08-02 07:05:17.907487	2025-08-02 07:05:17.907487	\N	verduras	\N	verduras	\N	active	3	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	\N
5bb586d7-bf2c-4c98-a8ed-87afc0470446	2025-08-02 07:05:31.749922	2025-08-02 07:05:31.749922	\N	carnes	\N	carnes	\N	active	4	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	\N
c62171b3-9028-451c-a281-de609899132f	2025-08-02 07:19:21.668798	2025-08-02 07:19:21.668798	\N	soplados	\N	soplados	\N	active	5	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	\N
1e5c2921-e551-4f52-b99e-98cb473251a6	2025-08-02 07:19:42.811189	2025-08-02 07:19:42.811189	\N	embutidos	\N	embutidos	\N	active	6	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	\N
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, created_at, updated_at, deleted_at, "firstName", "lastName", "companyName", email, phone, mobile, "documentType", "documentNumber", address, city, state, "zipCode", country, status, organization_id, "creditLimit", "currentBalance", "paymentTerms", "birthDate", notes, metadata, "lastPurchaseAt", "totalPurchases", "totalOrders") FROM stdin;
4a7e9fac-e8d9-49c2-b94b-6a6c49f02cec	2025-08-02 06:07:00.575002	2025-08-02 06:07:00.575002	\N	jesus	jimenez	\N	jesus@gmail.com	\N	\N	cc	37177608	\N	\N	\N	\N	Colombia	active	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	0.00	0.00	30	\N	\N	\N	\N	0.00	0
deca4807-ce04-431c-b85a-a3b6380deac8	2025-08-02 05:53:40.822926	2025-08-02 06:11:29.288566	\N	evelin	jimenez	\N	evelin@gmail.com	\N	\N	cc	2000001411	\N	\N	\N	\N	Colombia	active	8970d85a-4254-4066-800d-10150a9c5135	0.00	0.00	30	\N	\N	\N	\N	0.00	0
832657f1-f7a3-4a05-846f-e19d0a257025	2025-08-02 05:52:13.586995	2025-08-02 06:11:38.210494	\N	Consumidor	Final	\N	consumidorfinal@ventas.com	\N	\N	cc	222222222222	\N	\N	\N	\N	Colombia	active	8970d85a-4254-4066-800d-10150a9c5135	0.00	0.00	30	\N	\N	\N	\N	0.00	0
1720573c-37d8-4532-b987-dd181d8ee9bd	2025-08-02 14:03:00.910212	2025-08-02 14:03:00.910212	\N	pedro	elias	\N	pedroelias@gmail.com	\N	\N	cc	980543257	\N	\N	\N	\N	Colombia	active	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	0.00	0.00	30	\N	\N	\N	\N	0.00	0
7920ef2f-5c58-420c-8230-7a7da1771127	2025-08-02 14:04:09.394481	2025-08-02 14:04:09.394481	\N	karla	viviana	\N	karla@gmail.com	\N	\N	cc	1093765553	\N	\N	\N	\N	Colombia	active	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	0.00	0.00	30	\N	\N	\N	\N	0.00	0
3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	2025-08-02 05:49:10.564563	2025-08-02 15:40:40.435114	\N	Consumidor	Final	\N	consumidorfinal@ventas.com	\N	\N	cc	222222222222	\N	\N	\N	\N	Colombia	active	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	0.00	0.00	30	\N	\N	\N	\N	0.00	0
\.


--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expense_categories (id, created_at, updated_at, deleted_at, name, description, color, status, "monthlyBudget", "isRequired", "sortOrder", organization_id) FROM stdin;
8f194c0c-6176-4449-a5e1-4f5db7da7348	2025-08-02 06:13:14.56612	2025-08-02 06:13:14.56612	\N	Servicios Publicos	\N	#4caf50	active	0.00	f	0	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1
5b391f25-c158-49e7-abf2-cd10ab4997b0	2025-08-02 06:14:32.161466	2025-08-02 06:14:32.161466	\N	Arriendo	\N	#2196f3	active	0.00	f	0	8970d85a-4254-4066-800d-10150a9c5135
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expenses (id, created_at, updated_at, deleted_at, description, amount, date, status, type, "paymentMethod", vendor, "invoiceNumber", reference, notes, attachments, tags, metadata, "approvedById", "approvedAt", "rejectionReason", organization_id, "categoryId", "createdById", category_id, created_by_id, approved_by_id) FROM stdin;
45d68b77-6fa0-41cb-bf2d-58c4d73f12ef	2025-08-02 06:13:41.688259	2025-08-02 06:13:41.688259	\N	recibo del agua	80000.00	2025-08-02	approved	operating	cash	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	8f194c0c-6176-4449-a5e1-4f5db7da7348	bfd3a2f9-57b7-47e6-b923-005cabd00026	\N	\N	\N
5d73e93a-fd50-4875-b12a-08d22758e585	2025-08-02 06:14:51.458264	2025-08-02 06:14:51.458264	\N	Arriendo	600000.00	2025-08-02	approved	operating	cash	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	8970d85a-4254-4066-800d-10150a9c5135	5b391f25-c158-49e7-abf2-cd10ab4997b0	8ad00704-ae38-4fee-8919-12ba8528cb22	\N	\N	\N
\.


--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_items (id, created_at, updated_at, deleted_at, description, quantity, "unitPrice", "discountPercentage", "discountAmount", subtotal, unit, notes, "invoiceId", "productId", "temporaryProductId") FROM stdin;
81085ac2-416d-48f0-b92e-e194ac3de6c7	2025-08-02 05:55:42.400523	2025-08-02 05:55:42.400523	\N	talco mexsana	1	9000	0	0	7563.03	pcs	\N	301744e7-ded1-4d60-b22c-692dec791477	95c13a80-a433-478d-8ba7-752759201762	\N
dec6b77e-be72-4e44-a4e4-c573f0ed9372	2025-08-02 06:00:36.076267	2025-08-02 06:00:36.076267	\N	desodorante speed stick	1	5000	0	0	4201.68	pcs	\N	b1dac28a-e780-43ee-93f2-9a953d86806c	cecd2f25-4913-485c-9f8e-51695390b489	\N
d056fa71-3ec7-4195-b1b7-7ead95207b71	2025-08-02 06:11:29.241251	2025-08-02 06:11:29.241251	\N	impresora termica	1	320000	0	0	268907.56	pcs	\N	f33903f6-8a41-4935-a4c5-7728a95e6986	3dcc2d14-943a-479c-a961-9d395d538fe4	\N
e15051d4-a46b-44d8-9ac9-bd3e45dfc550	2025-08-02 06:11:29.241251	2025-08-02 06:11:29.241251	\N	talco mexsana	1	9000	0	0	7563.03	pcs	\N	f33903f6-8a41-4935-a4c5-7728a95e6986	95c13a80-a433-478d-8ba7-752759201762	\N
faed7598-af8f-4cf0-be2e-b90bd22f9fa1	2025-08-02 06:11:38.19413	2025-08-02 06:11:38.19413	\N	talco mexsana	1	9000	0	0	7563.03	pcs	\N	7d593c40-c796-424f-a269-6ef27703b197	95c13a80-a433-478d-8ba7-752759201762	\N
5f6e09c3-138a-4aec-a665-d87e509d89ae	2025-08-02 06:23:29.584098	2025-08-02 06:23:29.584098	\N	papas	1	2000	0	0	1680.67	pcs	\N	6ca7cc37-dce2-462a-b626-f411f7691d4e	\N	b37eabf2-0d3d-4b8d-8cb8-bccc25a46a84
8ca8a6f0-3693-4457-849a-5b817a19a3b7	2025-08-02 14:10:47.712231	2025-08-02 14:10:47.712231	\N	papas	1	13815	0	0	11609.24	pcs	\N	e6c3cbee-d630-40af-a43a-a371f91a1831	\N	a540a3da-b2ce-42e9-9f49-a02a8ecae683
6de53950-7175-42a8-be91-224be91cf6e3	2025-08-02 14:10:47.712231	2025-08-02 14:10:47.712231	\N	talco mexsana	2	10000	0	0	16806.72	pcs	\N	e6c3cbee-d630-40af-a43a-a371f91a1831	5e36b538-1fdb-4596-9715-7283da00259d	\N
11dad631-ed71-4640-97f6-2ec03da1de1e	2025-08-02 14:13:30.773237	2025-08-02 14:13:30.773237	\N	desodorante speed stick	67	5000	0	0	281512.61	pcs	\N	cc1d3129-cc50-48a8-9643-267fb955b971	cecd2f25-4913-485c-9f8e-51695390b489	\N
56b94966-bc66-4c8c-90b0-b09e16d80ff4	2025-08-02 14:13:30.773237	2025-08-02 14:13:30.773237	\N	talco mexsana	14	10000	0	0	117647.06	pcs	\N	cc1d3129-cc50-48a8-9643-267fb955b971	5e36b538-1fdb-4596-9715-7283da00259d	\N
22662158-2785-4ef1-9e23-ff07c79ca50f	2025-08-02 15:10:55.214388	2025-08-02 15:10:55.214388	\N	talco mexsana	1	10000	0	0	8403.36	pcs	\N	fe6d8ed2-469b-4fcf-b941-c77d128d42e8	5e36b538-1fdb-4596-9715-7283da00259d	\N
b16d78fd-c3ea-4357-9248-5be2f5376315	2025-08-02 15:11:13.67343	2025-08-02 15:11:13.67343	\N	Producto sin registrar	1	1460	0	0	1226.89	pcs	\N	dbb37b6b-ce38-4c2d-8ea8-8d2ba7c3530b	\N	1b5b44a6-fa75-4563-a33b-60017f961ddf
a6197529-0053-4ba7-aa87-f5d3ebfa4803	2025-08-02 15:11:13.67343	2025-08-02 15:11:13.67343	\N	Producto sin registrar	1	16000	0	0	13445.38	pcs	\N	dbb37b6b-ce38-4c2d-8ea8-8d2ba7c3530b	\N	58f2e8d7-5ddc-41c4-bcc5-a946bdc8cc52
0e4c66d7-8b9d-45e3-8ec1-84b90b8d128a	2025-08-02 15:39:04.467629	2025-08-02 15:39:04.467629	\N	desodorante speed stick	1	5000	0	0	4201.68	pcs	\N	ffdba90b-707d-4aaf-998c-8f42d4bbd0bd	cecd2f25-4913-485c-9f8e-51695390b489	\N
8cae894c-2997-4966-9713-b4ec3da24ddf	2025-08-02 15:39:04.467629	2025-08-02 15:39:04.467629	\N	talco mexsana	1	10000	0	0	8403.36	pcs	\N	ffdba90b-707d-4aaf-998c-8f42d4bbd0bd	5e36b538-1fdb-4596-9715-7283da00259d	\N
2a530cea-3488-458f-afc8-131e32d87647	2025-08-02 15:39:04.467629	2025-08-02 15:39:04.467629	\N	Producto sin registrar	1	20000	0	0	16806.72	pcs	\N	ffdba90b-707d-4aaf-998c-8f42d4bbd0bd	\N	c8d903d7-05c5-468b-9f55-22ddc26f5fdf
27b614fa-aeca-4578-be56-fc319ccd3268	2025-08-02 15:39:04.467629	2025-08-02 15:39:04.467629	\N	Producto sin registrar	1	20000	0	0	16806.72	pcs	\N	ffdba90b-707d-4aaf-998c-8f42d4bbd0bd	\N	0bc2a96b-3e87-4346-8d04-f70a3ed1e5c4
d60c48b4-5758-4f69-aac7-6ce8dc872d11	2025-08-02 15:39:39.938655	2025-08-02 15:39:39.938655	\N	Producto sin registrar	1	1650	0	0	1386.55	pcs	\N	adf2b7a6-84bf-47e8-8745-a98a68804217	\N	8eda39a0-229a-416e-b969-7edb4a999002
4e8723d6-3ee8-4389-9d69-73261a7532fd	2025-08-02 15:39:39.938655	2025-08-02 15:39:39.938655	\N	Producto sin registrar	1	1500	0	0	1260.5	pcs	\N	adf2b7a6-84bf-47e8-8745-a98a68804217	\N	fd643092-2cb1-484c-b6c2-852c964d9a0a
ccdb2925-ce5f-498f-8826-992fc6ee5bda	2025-08-02 15:39:39.938655	2025-08-02 15:39:39.938655	\N	desodorante speed stick	1	5000	0	0	4201.68	pcs	\N	adf2b7a6-84bf-47e8-8745-a98a68804217	cecd2f25-4913-485c-9f8e-51695390b489	\N
dd872742-8cd0-4d65-bb67-ca729e3178e0	2025-08-02 15:39:39.938655	2025-08-02 15:39:39.938655	\N	talco mexsana	1	10000	0	0	8403.36	pcs	\N	adf2b7a6-84bf-47e8-8745-a98a68804217	5e36b538-1fdb-4596-9715-7283da00259d	\N
4cc2bceb-9431-4cb9-9940-143dd3147fda	2025-08-02 15:39:39.938655	2025-08-02 15:39:39.938655	\N	Producto sin registrar	1	20000	0	0	16806.72	pcs	\N	adf2b7a6-84bf-47e8-8745-a98a68804217	\N	528841af-b4fb-421c-8953-f546ee457544
17631b90-c544-4d72-8ece-a11469fa071c	2025-08-02 15:40:17.045172	2025-08-02 15:40:17.045172	\N	Producto sin registrar	1	20000	0	0	16806.72	pcs	\N	7897e298-7b81-4d04-8513-89fe08bd02ea	\N	6c85c57f-d6b4-4180-8fd9-14594a711be0
733fa74f-777d-421d-9e43-18cb23fe4f6e	2025-08-02 15:40:17.045172	2025-08-02 15:40:17.045172	\N	talco mexsana	1	10000	0	0	8403.36	pcs	\N	7897e298-7b81-4d04-8513-89fe08bd02ea	5e36b538-1fdb-4596-9715-7283da00259d	\N
e3b32d00-4101-4309-b5b4-9f0e3d35e836	2025-08-02 15:40:17.045172	2025-08-02 15:40:17.045172	\N	Producto sin registrar	1	20000	0	0	16806.72	pcs	\N	7897e298-7b81-4d04-8513-89fe08bd02ea	\N	543c56a2-e1da-4b38-afb0-c3ee2eacd0ae
fd5ce65d-508c-4712-88c8-a4a8fa8cea99	2025-08-02 15:40:17.045172	2025-08-02 15:40:17.045172	\N	Producto sin registrar	1	2000	0	0	1680.67	pcs	\N	7897e298-7b81-4d04-8513-89fe08bd02ea	\N	0dfc4164-57e1-4597-ab92-86e76b54082a
7aa5be94-e7a9-4fbb-8fcd-3395e9d59888	2025-08-02 15:40:40.404181	2025-08-02 15:40:40.404181	\N	Producto sin registrar	1	1500	0	0	1260.5	pcs	\N	58bcc987-5ffc-4787-8458-e9704076a20f	\N	db97d5dd-2b8e-4600-aba4-019f1d94e4fe
42480664-a09d-46c5-980a-b16c61691037	2025-08-02 15:40:40.404181	2025-08-02 15:40:40.404181	\N	talco mexsana	3	10000	0	0	25210.08	pcs	\N	58bcc987-5ffc-4787-8458-e9704076a20f	5e36b538-1fdb-4596-9715-7283da00259d	\N
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, created_at, updated_at, deleted_at, number, date, "dueDate", status, "paymentMethod", subtotal, "taxPercentage", "taxAmount", "discountPercentage", "discountAmount", total, "paidAmount", "balanceDue", notes, terms, metadata, organization_id, "customerId", "createdById") FROM stdin;
301744e7-ded1-4d60-b22c-692dec791477	2025-08-02 05:55:42.400523	2025-08-02 05:55:42.400523	\N	INV-2025-142402	2025-08-02	2025-08-02	paid	cash	7563.03	19	1436.98	0	0	9000.01	9000.01	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $7.563\nIVA (19.0%): $1.437\nTOTAL: $9.000\nRecibido: $9.000\nCambio: $0\nFecha: 2025-08-02 00:55:42\nCliente: Consumidor Final\n	Venta de contado	\N	8970d85a-4254-4066-800d-10150a9c5135	832657f1-f7a3-4a05-846f-e19d0a257025	8ad00704-ae38-4fee-8919-12ba8528cb22
b1dac28a-e780-43ee-93f2-9a953d86806c	2025-08-02 06:00:36.076267	2025-08-02 06:00:36.076267	\N	INV-2025-436077	2025-08-02	2025-08-02	paid	cash	4201.68	19	798.32	0	0	5000	5000	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $4.202\nIVA (19.0%): $798\nTOTAL: $5.000\nRecibido: $5.000\nCambio: $0\nFecha: 2025-08-02 01:00:35\nCliente: Consumidor Final\n	Venta de contado	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	bfd3a2f9-57b7-47e6-b923-005cabd00026
f33903f6-8a41-4935-a4c5-7728a95e6986	2025-08-02 06:11:29.241251	2025-08-02 06:11:29.241251	\N	INV-2025-089243	2025-08-02	2025-08-02	paid	cash	276470.59	19	52529.41	0	0	329000	329000	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $276.471\nIVA (19.0%): $52.529\nTOTAL: $329.000\nRecibido: $329.000\nCambio: $0\nFecha: 2025-08-02 01:11:29\nCliente: evelin jimenez\n	Venta de contado	\N	8970d85a-4254-4066-800d-10150a9c5135	deca4807-ce04-431c-b85a-a3b6380deac8	8ad00704-ae38-4fee-8919-12ba8528cb22
7d593c40-c796-424f-a269-6ef27703b197	2025-08-02 06:11:38.19413	2025-08-02 06:11:38.19413	\N	INV-2025-098195	2025-08-02	2025-08-02	paid	cash	7563.03	19	1436.98	0	0	9000.01	9000.01	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $7.563\nIVA (19.0%): $1.437\nTOTAL: $9.000\nRecibido: $9.000\nCambio: $0\nFecha: 2025-08-02 01:11:38\nCliente: Consumidor Final\n	Venta de contado	\N	8970d85a-4254-4066-800d-10150a9c5135	832657f1-f7a3-4a05-846f-e19d0a257025	8ad00704-ae38-4fee-8919-12ba8528cb22
6ca7cc37-dce2-462a-b626-f411f7691d4e	2025-08-02 06:23:29.584098	2025-08-02 06:23:29.584098	\N	INV-2025-809585	2025-08-02	2025-08-02	paid	cash	1680.67	19	319.33	0	0	2000	2000	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $1.681\nIVA (19.0%): $319\nTOTAL: $2.000\nRecibido: $2.000\nCambio: $0\nFecha: 2025-08-02 01:23:29\nCliente: Consumidor Final\n	Venta de contado	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	bfd3a2f9-57b7-47e6-b923-005cabd00026
e6c3cbee-d630-40af-a43a-a371f91a1831	2025-08-02 14:10:47.712231	2025-08-02 14:10:47.712231	\N	INV-2025-847713	2025-08-02	2025-08-02	paid	cash	28415.96	19	5399.03	0	0	33814.99	33814.99	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $28.416\nIVA (19.0%): $5.399\nTOTAL: $33.815\nRecibido: $33.815\nCambio: $0\nFecha: 2025-08-02 09:10:47\nCliente: Consumidor Final\n	Venta de contado	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	bfd3a2f9-57b7-47e6-b923-005cabd00026
cc1d3129-cc50-48a8-9643-267fb955b971	2025-08-02 14:13:30.773237	2025-08-02 14:13:30.773237	\N	INV-2025-010776	2025-08-02	2025-08-02	paid	cash	399159.67	19	75840.34	0	0	475000.01	475000.01	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $399.160\nIVA (19.0%): $75.840\nTOTAL: $475.000\nRecibido: $475.000\nCambio: $0\nFecha: 2025-08-02 09:13:30\nCliente: Consumidor Final\n	Venta de contado	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	bfd3a2f9-57b7-47e6-b923-005cabd00026
fe6d8ed2-469b-4fcf-b941-c77d128d42e8	2025-08-02 15:10:55.214388	2025-08-02 15:10:55.214388	\N	INV-2025-455216	2025-08-02	2025-08-02	paid	cash	8403.36	19	1596.64	0	0	10000	10000	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $8.403\nIVA (19.0%): $1.597\nTOTAL: $10.000\nRecibido: $10.000\nCambio: $0\nFecha: 2025-08-02 10:10:55\nCliente: Consumidor Final\n	Venta de contado	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	bfd3a2f9-57b7-47e6-b923-005cabd00026
dbb37b6b-ce38-4c2d-8ea8-8d2ba7c3530b	2025-08-02 15:11:13.67343	2025-08-02 15:11:13.67343	\N	INV-2025-473674	2025-08-02	2025-08-02	paid	cash	14672.269999999999	19	2787.73	0	0	17460	17460	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $14.672\nIVA (19.0%): $2.788\nTOTAL: $17.460\nRecibido: $17.460\nCambio: $0\nFecha: 2025-08-02 10:11:13\nCliente: Consumidor Final\n	Venta de contado	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	bfd3a2f9-57b7-47e6-b923-005cabd00026
ffdba90b-707d-4aaf-998c-8f42d4bbd0bd	2025-08-02 15:39:04.467629	2025-08-02 15:39:04.467629	\N	INV-2025-144468	2025-08-02	2025-08-02	paid	cash	46218.48	19	8781.51	0	0	54999.99	54999.99	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $46.218\nIVA (19.0%): $8.782\nTOTAL: $55.000\nRecibido: $55.000\nCambio: $0\nFecha: 2025-08-02 10:39:04\nCliente: Consumidor Final\n	Venta de contado	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	bfd3a2f9-57b7-47e6-b923-005cabd00026
adf2b7a6-84bf-47e8-8745-a98a68804217	2025-08-02 15:39:39.938655	2025-08-02 15:39:39.938655	\N	INV-2025-179939	2025-08-02	2025-08-02	paid	cash	32058.81	19	6091.17	0	0	38149.98	38149.98	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $32.059\nIVA (19.0%): $6.091\nTOTAL: $38.150\nRecibido: $38.150\nCambio: $0\nFecha: 2025-08-02 10:39:39\nCliente: Consumidor Final\n	Venta de contado	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	bfd3a2f9-57b7-47e6-b923-005cabd00026
7897e298-7b81-4d04-8513-89fe08bd02ea	2025-08-02 15:40:17.045172	2025-08-02 15:40:17.045172	\N	INV-2025-217046	2025-08-02	2025-08-02	paid	cash	43697.47	19	8302.52	0	0	51999.99	51999.99	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $43.697\nIVA (19.0%): $8.303\nTOTAL: $52.000\nRecibido: $52.000\nCambio: $0\nFecha: 2025-08-02 10:40:16\nCliente: Consumidor Final\n	Venta de contado	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	bfd3a2f9-57b7-47e6-b923-005cabd00026
58bcc987-5ffc-4787-8458-e9704076a20f	2025-08-02 15:40:40.404181	2025-08-02 15:40:40.404181	\N	INV-2025-240404	2025-08-02	2025-08-02	paid	cash	26470.58	19	5029.41	0	0	31499.99	31499.99	0	Estado: PAGADA\nMetodo de Pago: Efectivo\nSubtotal sin IVA: $26.471\nIVA (19.0%): $5.029\nTOTAL: $31.500\nRecibido: $31.500\nCambio: $0\nFecha: 2025-08-02 10:40:40\nCliente: Consumidor Final\n	Venta de contado	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	3e102c0a-5dd9-42d7-9ccd-e7914d1c3e14	bfd3a2f9-57b7-47e6-b923-005cabd00026
\.


--
-- Data for Name: migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.migrations (id, "timestamp", name) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, type, priority, status, channels, title, message, "richContent", "entityId", "entityType", "actionUrl", "actionLabel", metadata, icon, color, "scheduledFor", "expiresAt", "retryCount", "maxRetries", "sentAt", "deliveredAt", "readAt", "archivedAt", "isGrouped", "groupKey", "userId", "organizationId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.organizations (id, created_at, updated_at, deleted_at, name, slug, domain, logo, settings, "isActive", currency, locale, timezone, "subscriptionStartDate", "subscriptionEndDate", "trialStartDate", "trialEndDate", "subscriptionPlan", "subscriptionStatus") FROM stdin;
8970d85a-4254-4066-800d-10150a9c5135	2025-08-02 04:00:44.083728	2025-08-02 06:15:55.829583	\N	Baudity	gmailcorp-182b2a04	\N	\N	{}	t	USD	en	America/New_York	2025-08-02 04:00:44.426	2025-09-01 04:00:44.426	2025-08-02 04:00:44.426	2025-09-01 04:00:44.426	trial	active
6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	2025-08-02 04:01:14.404597	2025-08-02 06:17:05.064359	\N	La Granada	gmailcorp-698dba62	\N	\N	{}	t	USD	en	America/New_York	2025-08-02 04:01:14.724	2025-09-01 04:01:14.724	2025-08-02 04:01:14.724	2025-09-01 04:01:14.724	trial	active
\.


--
-- Data for Name: product_prices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_prices (id, created_at, updated_at, deleted_at, type, name, amount, currency, status, "validFrom", "validTo", "discountPercentage", "discountAmount", "minQuantity", "profitMargin", notes, "productId", product_id) FROM stdin;
1d39ebd2-8cf3-49c1-a60e-b432cf24f890	2025-08-02 04:04:54.12859	2025-08-02 04:04:54.12859	\N	price1	Precio al público	9000.00	COP	active	\N	\N	0.00	\N	1	\N	\N	95c13a80-a433-478d-8ba7-752759201762	95c13a80-a433-478d-8ba7-752759201762
a5e77589-0e2e-4776-827c-4957aa92032d	2025-08-02 05:46:52.084146	2025-08-02 05:46:52.084146	\N	price1	Precio al público	10000.00	COP	active	\N	\N	0.00	\N	1	\N	\N	5e36b538-1fdb-4596-9715-7283da00259d	5e36b538-1fdb-4596-9715-7283da00259d
ddd70e50-25c0-44ef-bdba-de25a2df3bf7	2025-08-02 06:00:21.238	2025-08-02 06:00:21.238	\N	price1	Precio al público	5000.00	COP	active	\N	\N	0.00	\N	1	\N	\N	cecd2f25-4913-485c-9f8e-51695390b489	cecd2f25-4913-485c-9f8e-51695390b489
de538f9a-c7ff-4288-ba22-dce8988cf0ff	2025-08-02 06:05:11.340286	2025-08-02 06:05:11.340286	\N	price1	Precio al público	320000.00	COP	active	\N	\N	0.00	\N	1	\N	\N	3dcc2d14-943a-479c-a961-9d395d538fe4	3dcc2d14-943a-479c-a961-9d395d538fe4
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, created_at, updated_at, deleted_at, name, description, sku, barcode, type, status, stock, "minStock", unit, weight, length, width, height, images, metadata, organization_id, category_id, created_by_id) FROM stdin;
95c13a80-a433-478d-8ba7-752759201762	2025-08-02 04:04:54.12859	2025-08-02 04:04:54.12859	\N	talco mexsana	\N	TAL42211	7702123013815	product	active	100.00	0.00	pcs	\N	\N	\N	\N	\N	\N	8970d85a-4254-4066-800d-10150a9c5135	2233d449-005d-450f-a1d0-10ca7e281b19	8ad00704-ae38-4fee-8919-12ba8528cb22
5e36b538-1fdb-4596-9715-7283da00259d	2025-08-02 05:46:52.084146	2025-08-02 05:46:52.084146	\N	talco mexsana	\N	TAL71694	7702123013815	product	active	100.00	0.00	pcs	\N	\N	\N	\N	\N	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	71883010-7627-48fd-99d9-8a52fd0f6043	bfd3a2f9-57b7-47e6-b923-005cabd00026
cecd2f25-4913-485c-9f8e-51695390b489	2025-08-02 05:59:29.671513	2025-08-02 06:00:21.227253	\N	desodorante speed stick	\N	DES36835	7509546668666	product	active	100.00	0.00	pcs	\N	\N	\N	\N	\N	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	71883010-7627-48fd-99d9-8a52fd0f6043	bfd3a2f9-57b7-47e6-b923-005cabd00026
3dcc2d14-943a-479c-a961-9d395d538fe4	2025-08-02 06:05:11.340286	2025-08-02 06:05:11.340286	\N	impresora termica	\N	IMP54417	0732535929494	product	active	100.00	0.00	pcs	\N	\N	\N	\N	\N	\N	8970d85a-4254-4066-800d-10150a9c5135	2233d449-005d-450f-a1d0-10ca7e281b19	8ad00704-ae38-4fee-8919-12ba8528cb22
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subscriptions (id, created_at, updated_at, deleted_at, "organizationId", plan, status, type, "startDate", "endDate", "cancelledAt", "cancelReason", price, currency, "paymentMethod", "externalSubscriptionId", metadata, "maxUsers", "lastBillingDate", "nextBillingDate", "billingCycle", "autoRenew", "trialEndsAt", "isTrialUsed") FROM stdin;
b4539734-e877-4edc-9593-f1242281d045	2025-08-02 04:00:44.426558	2025-08-02 04:00:44.426558	\N	8970d85a-4254-4066-800d-10150a9c5135	trial	active	trial	2025-08-02 04:00:44.426	2025-09-01 04:00:44.426	\N	\N	\N	\N	\N	\N	\N	2	\N	\N	0	f	2025-09-01 04:00:44.426	t
65267058-1566-400f-8b00-3a007df7bce8	2025-08-02 04:01:14.725191	2025-08-02 04:01:14.725191	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1	trial	active	trial	2025-08-02 04:01:14.724	2025-09-01 04:01:14.724	\N	\N	\N	\N	\N	\N	\N	2	\N	\N	0	f	2025-09-01 04:01:14.724	t
\.


--
-- Data for Name: temporary_products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.temporary_products (id, created_at, updated_at, deleted_at, name, description, "unitPrice", unit, currency, category, metadata) FROM stdin;
b37eabf2-0d3d-4b8d-8cb8-bccc25a46a84	2025-08-02 06:23:29.571286	2025-08-02 06:23:29.571286	\N	papas	Producto temporal creado en factura	2000	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":2000}
a540a3da-b2ce-42e9-9f49-a02a8ecae683	2025-08-02 14:10:47.685931	2025-08-02 14:10:47.685931	\N	papas	Producto temporal creado en factura	13815	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":13815}
1b5b44a6-fa75-4563-a33b-60017f961ddf	2025-08-02 15:11:13.662268	2025-08-02 15:11:13.662268	\N	Producto sin registrar	Producto temporal creado en factura	1460	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":1460}
58f2e8d7-5ddc-41c4-bcc5-a946bdc8cc52	2025-08-02 15:11:13.670248	2025-08-02 15:11:13.670248	\N	Producto sin registrar	Producto temporal creado en factura	16000	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":16000}
c8d903d7-05c5-468b-9f55-22ddc26f5fdf	2025-08-02 15:39:04.456927	2025-08-02 15:39:04.456927	\N	Producto sin registrar	Producto temporal creado en factura	20000	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":20000}
0bc2a96b-3e87-4346-8d04-f70a3ed1e5c4	2025-08-02 15:39:04.466086	2025-08-02 15:39:04.466086	\N	Producto sin registrar	Producto temporal creado en factura	20000	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":20000}
8eda39a0-229a-416e-b969-7edb4a999002	2025-08-02 15:39:39.895389	2025-08-02 15:39:39.895389	\N	Producto sin registrar	Producto temporal creado en factura	1650	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":1650}
fd643092-2cb1-484c-b6c2-852c964d9a0a	2025-08-02 15:39:39.901071	2025-08-02 15:39:39.901071	\N	Producto sin registrar	Producto temporal creado en factura	1500	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":1500}
528841af-b4fb-421c-8953-f546ee457544	2025-08-02 15:39:39.936782	2025-08-02 15:39:39.936782	\N	Producto sin registrar	Producto temporal creado en factura	20000	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":20000}
6c85c57f-d6b4-4180-8fd9-14594a711be0	2025-08-02 15:40:17.020086	2025-08-02 15:40:17.020086	\N	Producto sin registrar	Producto temporal creado en factura	20000	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":20000}
543c56a2-e1da-4b38-afb0-c3ee2eacd0ae	2025-08-02 15:40:17.041497	2025-08-02 15:40:17.041497	\N	Producto sin registrar	Producto temporal creado en factura	20000	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":20000}
0dfc4164-57e1-4597-ab92-86e76b54082a	2025-08-02 15:40:17.042993	2025-08-02 15:40:17.042993	\N	Producto sin registrar	Producto temporal creado en factura	2000	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":2000}
db97d5dd-2b8e-4600-aba4-019f1d94e4fe	2025-08-02 15:40:40.383353	2025-08-02 15:40:40.383353	\N	Producto sin registrar	Producto temporal creado en factura	1500	pcs	COP	Sin categoría	{"createdInInvoice":true,"originalPrice":1500}
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, created_at, updated_at, deleted_at, "firstName", "lastName", email, password, phone, role, status, "lastLoginAt", avatar, organization_id) FROM stdin;
8ad00704-ae38-4fee-8919-12ba8528cb22	2025-08-02 04:00:44.117231	2025-08-02 06:14:05.545654	\N	juank	paez	juankpaez31@gmail.com	$2b$12$TJlzYQdWVJSeJt2Sh/hwN.swzfLaM9lLxrx5m/QgEIQhYYKGbrYUu	\N	user	active	2025-08-02 06:14:05.542	\N	8970d85a-4254-4066-800d-10150a9c5135
bfd3a2f9-57b7-47e6-b923-005cabd00026	2025-08-02 04:01:14.42907	2025-08-02 14:08:32.830994	\N	paola	diaz	paola@gmail.com	$2b$12$Umr5I9GcMS.IPyQ5dOkRKuHApwGvhW9CDjTLPjOahlmfvrjVMN6VW	\N	user	active	2025-08-02 14:08:32.827	\N	6fe49c97-ebe2-472f-969e-aaf94ad2b7c1
\.


--
-- Name: migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.migrations_id_seq', 1, false);


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
-- Name: notifications PK_6a72c3c0f683f6462415e653c3a; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id);


--
-- Name: organizations PK_6b031fcd0863e3f6b44230163f9; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT "PK_6b031fcd0863e3f6b44230163f9" PRIMARY KEY (id);


--
-- Name: activities PK_7f4004429f731ffb9c88eb486a8; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "PK_7f4004429f731ffb9c88eb486a8" PRIMARY KEY (id);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


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
-- Name: IDX_21a659804ed7bf61eb91688dea; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_21a659804ed7bf61eb91688dea" ON public.users USING btree (organization_id);


--
-- Name: IDX_2d404aa7aa4a0404eafd184091; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_2d404aa7aa4a0404eafd184091" ON public.products USING btree (organization_id);


--
-- Name: IDX_3be5a1cd1440a9d121e1051e5c; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_3be5a1cd1440a9d121e1051e5c" ON public.activities USING btree ("organizationId", "createdAt");


--
-- Name: IDX_3f1674ecdbb7e1c9d1e21a5685; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_3f1674ecdbb7e1c9d1e21a5685" ON public.notifications USING btree ("userId", status, "createdAt");


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
-- Name: IDX_99aee0acb621a3ee93a8943a51; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_99aee0acb621a3ee93a8943a51" ON public.notifications USING btree ("organizationId", priority, "createdAt");


--
-- Name: IDX_a713916d96f313cb62dd563df1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_a713916d96f313cb62dd563df1" ON public.expense_categories USING btree (organization_id);


--
-- Name: IDX_a7a84c705f3e8e4fbd497cfb11; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_a7a84c705f3e8e4fbd497cfb11" ON public.subscriptions USING btree ("organizationId");


--
-- Name: IDX_bbe617daf59c7445c7e988f1ec; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_bbe617daf59c7445c7e988f1ec" ON public.activities USING btree ("userId", "createdAt");


--
-- Name: IDX_bfac25cac85a4c76e896d5cfa1; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_bfac25cac85a4c76e896d5cfa1" ON public.categories USING btree (organization_id);


--
-- Name: IDX_d2fc0e42b07d01fafc3fbb2bee; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_d2fc0e42b07d01fafc3fbb2bee" ON public.customers USING btree (organization_id);


--
-- Name: IDX_d3c5ff953c323a6a5aeba8dafa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_d3c5ff953c323a6a5aeba8dafa" ON public.activities USING btree (type, "createdAt");


--
-- Name: IDX_d4e095bcd100de447d3c27708f; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_d4e095bcd100de447d3c27708f" ON public.invoices USING btree (organization_id);


--
-- Name: IDX_eeb28b686a8c3472a22d67d239; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_eeb28b686a8c3472a22d67d239" ON public.subscriptions USING btree ("organizationId", status);


--
-- Name: IDX_f8aa5a0ec5345433ba253a7eaa; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_f8aa5a0ec5345433ba253a7eaa" ON public.notifications USING btree (type, status);


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
-- Name: activities FK_5a2cfe6f705df945b20c1b22c71; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "FK_5a2cfe6f705df945b20c1b22c71" FOREIGN KEY ("userId") REFERENCES public.users(id);


--
-- Name: expenses FK_5d1f4be708e0dfe2afa1a3c376c; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT "FK_5d1f4be708e0dfe2afa1a3c376c" FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE RESTRICT;


--
-- Name: notifications FK_692a909ee0fa9383e7859f9b406; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES public.users(id);


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
-- Name: notifications FK_928914a0743f50e6f83a90cdda9; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_928914a0743f50e6f83a90cdda9" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);


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
-- Name: activities FK_b8168e2c3e209999463d40cead5; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT "FK_b8168e2c3e209999463d40cead5" FOREIGN KEY ("organizationId") REFERENCES public.organizations(id);


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

