package restengine

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"time"

	jwtmiddleware "github.com/auth0/go-jwt-middleware/v2"
	"github.com/auth0/go-jwt-middleware/v2/jwks"
	"github.com/auth0/go-jwt-middleware/v2/validator"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// CustomClaims contains custom data we want from the token.
type CustomClaims struct {
	Scope string   `json:"scope"`
	Email string   `json:"email"`
	Teams []string `json:"teams"`
}

// Validate does nothing for this example, but we need
// it to satisfy validator.CustomClaims interface.
func (c CustomClaims) Validate(ctx context.Context) error {
	return nil
}

const AUTH0_DOMAIN = "dev-wbtkmuby1sf63ogy.us.auth0.com"
const AUTH0_AUDIENCE = "https://api.pristine.test/"

func GetValidatedToken(c *gin.Context) (*validator.ValidatedClaims, error) {
	val := c.Request.Context().Value(jwtmiddleware.ContextKey{})
	if val == nil {
		return nil, errors.New("no validated JWT claims found in request1")
	}
	if s, ok := val.(*validator.ValidatedClaims); ok {
		return s, nil
	} else {
		return nil, errors.New("no validated JWT claims found in request2")
	}
}

// EnsureValidToken is a middleware that will check the validity of our JWT.
func EnsureValidToken() func(next http.Handler) http.Handler {
	issuerURL, err := url.Parse("https://" + AUTH0_DOMAIN + "/")
	if err != nil {
		log.Error().Err(err).Msg("failed to parse the issuer url")
		return nil
	}

	provider := jwks.NewCachingProvider(issuerURL, 5*time.Minute)

	jwtValidator, err := validator.New(
		provider.KeyFunc,
		validator.RS256,
		issuerURL.String(),
		[]string{AUTH0_AUDIENCE},
		validator.WithCustomClaims(
			func() validator.CustomClaims {
				return &CustomClaims{}
			},
		),
		validator.WithAllowedClockSkew(time.Minute),
	)
	if err != nil {
		log.Error().Err(err).Msg("failed to set up the JWT validator")
		return nil
	}

	errorHandler := func(w http.ResponseWriter, r *http.Request, err error) {
		log.Error().Err(err).Msg("encountered error while validating JWT")

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		w.Write([]byte(`{"message":"Failed to validate JWT."}`))
	}

	middleware := jwtmiddleware.New(
		jwtValidator.ValidateToken,
		jwtmiddleware.WithErrorHandler(errorHandler),
	)

	return func(next http.Handler) http.Handler {
		return middleware.CheckJWT(next)
	}
}
