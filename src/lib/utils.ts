export const getGradient = (title: string) => {
  const gradients = [
    'linear-gradient(135deg, #1a3a5c, #2d6b9e)',
    'linear-gradient(135deg, #3a1a1a, #8c3030)',
    'linear-gradient(135deg, #1a3a1a, #2d7a2d)',
    'linear-gradient(135deg, #2d1a3a, #6b2d8c)',
    'linear-gradient(135deg, #3a2a1a, #8c6b2d)',
    'linear-gradient(135deg, #1a2d3a, #2d6b8c)',
    'linear-gradient(135deg, #3a1a2d, #8c2d6b)',
    'linear-gradient(135deg, #1a1a3a, #3a3a8c)'
  ]
  return gradients[(title || 'B').charCodeAt(0) % 8]
}
