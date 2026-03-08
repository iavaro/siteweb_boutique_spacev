/**
 * SpaceV - Product Routes
 * =======================
 * Handles product catalog, categories, and product details.
 * 
 * Endpoints:
 * - GET /api/products - List all products (with filters)
 * - GET /api/products/:slug - Get single product by slug
 * - GET /api/products/categories - List all categories
 * - GET /api/products/category/:slug - Get products by category
 * - GET /api/products/featured - Get featured products
 * 
 * Admin endpoints (protected):
 * - POST /api/products - Create product
 * - PUT /api/products/:id - Update product
 * - DELETE /api/products/:id - Delete product
 * 
 * @author SpaceV
 * @version 1.0.0
 */

const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient');
const { authenticateToken, requireAdmin } = require('../middlewares/auth');
const { asyncHandler } = require('../middlewares/errorHandler');

// ==============================================
// GET /api/products - List products
// ==============================================
router.get('/', asyncHandler(async (req, res) => {
  const { 
    category, 
    type, 
    search, 
    featured, 
    page = 1, 
    limit = 20,
    sort = 'sortOrder',
    order = 'asc'
  } = req.query;

  // Build query
  const where = {
    isActive: true,
  };

  // Filter by category
  if (category) {
    const cat = await prisma.category.findUnique({ where: { slug: category } });
    if (cat) {
      where.categoryId = cat.id;
    }
  }

  // Filter by type
  if (type) {
    where.type = type.toUpperCase();
  }

  // Search by name or description
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  // Filter featured
  if (featured === 'true') {
    where.isFeatured = true;
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Get products
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        [sort]: order,
      },
      skip,
      take: parseInt(limit),
    }),
    prisma.product.count({ where }),
  ]);

  res.json({
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

// ==============================================
// GET /api/products/featured - Featured products
// ==============================================
router.get('/featured', asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      isFeatured: true,
    },
    include: {
      category: true,
    },
    orderBy: {
      sortOrder: 'asc',
    },
    take: 6,
  });

  res.json({ products });
}));

// ==============================================
// GET /api/products/categories - All categories
// ==============================================
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: {
      sortOrder: 'asc',
    },
  });

  // Format response
  const formatted = categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    image: cat.image,
    productCount: cat._count.products,
  }));

  res.json({ categories: formatted });
}));

// ==============================================
// GET /api/products/category/:slug - Products by category
// ==============================================
router.get('/category/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { page = 1, limit = 20 } = req.query;

  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: {
        categoryId: category.id,
        isActive: true,
      },
      include: {
        category: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
      skip,
      take: parseInt(limit),
    }),
    prisma.product.count({
      where: {
        categoryId: category.id,
        isActive: true,
      },
    }),
  ]);

  res.json({
    category,
    products,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

// ==============================================
// GET /api/products/:slug - Single product
// ==============================================
router.get('/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
    },
  });

  if (!product || !product.isActive) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Get related products
  const relatedProducts = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: product.id },
      isActive: true,
    },
    include: {
      category: true,
    },
    take: 4,
  });

  res.json({ product, relatedProducts });
}));

// ==============================================
// ADMIN: POST /api/products - Create product
// ==============================================
router.post('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { 
    name, 
    slug, 
    description, 
    price, 
    image, 
    categoryId,
    type,
    TebexPackageId,
    isFeatured,
    isActive,
    metadata
  } = req.body;

  // Validate required fields
  if (!name || !slug || price === undefined) {
    return res.status(400).json({ error: 'Name, slug, and price are required' });
  }

  // Check if slug already exists
  const existingSlug = await prisma.product.findUnique({ where: { slug } });
  if (existingSlug) {
    return res.status(409).json({ error: 'Product slug already exists' });
  }

  // Create product
  const product = await prisma.product.create({
    data: {
      name,
      slug,
      description,
      price: parseFloat(price),
      image,
      categoryId: categoryId || null,
      type: type || 'ITEM',
      TebexPackageId: TebexPackageId || null,
      isFeatured: isFeatured || false,
      isActive: isActive !== false,
      metadata: metadata || {},
    },
    include: {
      category: true,
    },
  });

  res.status(201).json({ 
    message: 'Product created successfully',
    product 
  });
}));

// ==============================================
// ADMIN: PUT /api/products/:id - Update product
// ==============================================
router.put('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    name, 
    slug, 
    description, 
    price, 
    image, 
    categoryId,
    type,
    TebexPackageId,
    isFeatured,
    isActive,
    metadata
  } = req.body;

  // Check if product exists
  const existing = await prisma.product.findUnique({ where: { id: parseInt(id) } });
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Check if slug is being changed and if it's unique
  if (slug && slug !== existing.slug) {
    const slugExists = await prisma.product.findUnique({ where: { slug } });
    if (slugExists) {
      return res.status(409).json({ error: 'Product slug already exists' });
    }
  }

  // Update product
  const product = await prisma.product.update({
    where: { id: parseInt(id) },
    data: {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(image !== undefined && { image }),
      ...(categoryId !== undefined && { categoryId: categoryId || null }),
      ...(type && { type }),
      ...(TebexPackageId !== undefined && { TebexPackageId: TebexPackageId || null }),
      ...(isFeatured !== undefined && { isFeatured }),
      ...(isActive !== undefined && { isActive }),
      ...(metadata && { metadata }),
    },
    include: {
      category: true,
    },
  });

  res.json({ 
    message: 'Product updated successfully',
    product 
  });
}));

// ==============================================
// ADMIN: DELETE /api/products/:id - Delete product
// ==============================================
router.delete('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if product exists
  const existing = await prisma.product.findUnique({ where: { id: parseInt(id) } });
  if (!existing) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Soft delete - just set inactive
  await prisma.product.update({
    where: { id: parseInt(id) },
    data: { isActive: false },
  });

  res.json({ message: 'Product deleted successfully' });
}));

// ==============================================
// ADMIN: Categories CRUD
// ==============================================

// GET categories (admin)
router.get('/admin/categories', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: {
      sortOrder: 'asc',
    },
  });

  res.json({ categories });
}));

// POST category
router.post('/categories', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { name, slug, description, image, sortOrder } = req.body;

  if (!name || !slug) {
    return res.status(400).json({ error: 'Name and slug are required' });
  }

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    return res.status(409).json({ error: 'Category slug already exists' });
  }

  const category = await prisma.category.create({
    data: {
      name,
      slug,
      description,
      image,
      sortOrder: sortOrder || 0,
    },
  });

  res.status(201).json({ message: 'Category created', category });
}));

// PUT category
router.put('/categories/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, slug, description, image, sortOrder, isActive } = req.body;

  const existing = await prisma.category.findUnique({ where: { id: parseInt(id) } });
  if (!existing) {
    return res.status(404).json({ error: 'Category not found' });
  }

  const category = await prisma.category.update({
    where: { id: parseInt(id) },
    data: {
      ...(name && { name }),
      ...(slug && { slug }),
      ...(description !== undefined && { description }),
      ...(image !== undefined && { image }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  res.json({ message: 'Category updated', category });
}));

// DELETE category
router.delete('/categories/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const existing = await prisma.category.findUnique({ where: { id: parseInt(id) } });
  if (!existing) {
    return res.status(404).json({ error: 'Category not found' });
  }

  await prisma.category.update({
    where: { id: parseInt(id) },
    data: { isActive: false },
  });

  res.json({ message: 'Category deleted' });
}));

module.exports = router;

