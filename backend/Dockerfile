# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution file
COPY ["App.sln", "./"]

# Copy all .csproj files preserving their folder structure
COPY ["Api/Api.csproj", "Api/"]
COPY ["Context/Context.csproj", "Context/"]
COPY ["Service/Service.csproj", "Service/"]

# Restore dependencies for the entire solution
RUN dotnet restore "App.sln"

# Copy the remaining source code and publish
COPY . .
WORKDIR "/src/Api"
RUN dotnet publish -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5138
EXPOSE 5138

ENTRYPOINT ["dotnet", "Api.dll"]