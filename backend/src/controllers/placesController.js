const { z } = require('zod');
const mapsService = require('../services/mapsService');

const autocompleteSchema = z.object({
  input:        z.string().min(2, 'input must be at least 2 characters'),
  lat:          z.coerce.number().min(-90).max(90).optional(),
  lng:          z.coerce.number().min(-180).max(180).optional(),
  sessionToken: z.string().optional(),
});

const detailsSchema = z.object({
  placeId:      z.string().min(1),
  sessionToken: z.string().optional(),
});

class PlacesController {

  /**
   * GET /api/places/autocomplete
   * Returns place suggestions for the given text input.
   *
   * Query params:
   *   input        {string}  - Text the user has typed (min 2 chars)
   *   lat          {number}  - User latitude  (biases results to nearby places)
   *   lng          {number}  - User longitude (biases results to nearby places)
   *   sessionToken {string}  - Groups calls into one billing session (optional)
   */
  async autocomplete(req, res, next) {
    try {
      const { input, lat, lng, sessionToken } = autocompleteSchema.parse(req.query);
      const location = lat !== undefined && lng !== undefined ? [lat, lng] : undefined;
      const suggestions = await mapsService.getPlacesAutocomplete(input, sessionToken, location);
      res.status(200).json({ success: true, count: suggestions.length, data: suggestions });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/places/details
   * Converts a Google Place ID into coordinates and address.
   * Called when the user selects an autocomplete suggestion.
   *
   * Query params:
   *   placeId      {string} - Google Place ID from autocomplete response
   *   sessionToken {string} - Same token used during autocomplete (optional)
   */
  async details(req, res, next) {
    try {
      const { placeId, sessionToken } = detailsSchema.parse(req.query);
      const details = await mapsService.getPlaceDetails(placeId, sessionToken);
      res.status(200).json({ success: true, data: details });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PlacesController();
